package member

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/fivemanage/lite/api"
	"github.com/fivemanage/lite/internal/crypt"
	"github.com/fivemanage/lite/internal/database"
	organizationquery "github.com/fivemanage/lite/internal/database/query/organization"
	"github.com/labstack/echo/v4"
	"github.com/uptrace/bun"
)

type Service struct {
	db *bun.DB
}

func NewService(db *bun.DB) *Service {
	return &Service{db: db}
}

func publicMember(member *database.OrganizationMember) *api.OrganizationMember {
	result := &api.OrganizationMember{ID: member.ID, UserID: member.UserID, Role: member.Role}
	if member.User != nil {
		result.Username = member.User.Username
		result.Email = member.User.Email
		result.Name = member.User.Name
		result.IsAdmin = member.User.IsAdmin
	}
	return result
}

func (s *Service) ListMembers(ctx context.Context, organizationID string) ([]*api.OrganizationMember, error) {
	dbMembers, err := organizationquery.ListMembers(ctx, s.db, organizationID)
	if err != nil {
		return nil, err
	}
	members := make([]*api.OrganizationMember, 0, len(dbMembers))
	for i := range dbMembers {
		members = append(members, publicMember(&dbMembers[i]))
	}
	return members, nil
}

func (s *Service) Add(ctx context.Context, organizationID string, actorID int64, data *api.AddOrganizationMemberRequest) (*api.OrganizationMember, error) {
	data.Username = strings.TrimSpace(data.Username)
	data.Name = strings.TrimSpace(data.Name)
	data.Email = strings.TrimSpace(data.Email)
	if data.Username == "" || strings.ContainsAny(data.Username, " \t\r\n") {
		return nil, echo.NewHTTPError(400, "Username must not be empty or contain whitespace")
	}
	var result *api.OrganizationMember
	err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if err := organizationquery.Lock(ctx, tx, organizationID, true); err != nil {
			return err
		}
		if err := organizationquery.RequireAdmin(ctx, tx, organizationID, actorID); err != nil {
			return err
		}
		// Serialize provisioning of the same login across organizations.
		if _, err := tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", "user:"+data.Username); err != nil {
			return err
		}
		user := new(database.User)
		err := tx.NewSelect().Model(user).Where("username = ?", data.Username).Scan(ctx)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if data.Create {
			if err == nil {
				return echo.NewHTTPError(409, "Username already exists; use Add existing user instead")
			}
			if data.Name == "" || data.Email == "" || len(data.Password) < 12 || len(data.Password) > 72 {
				return echo.NewHTTPError(400, "New users require a name, email and a password of 12–72 bytes")
			}
			hash, err := crypt.HashPassword(data.Password)
			if err != nil {
				return err
			}
			user = &database.User{Name: data.Name, Username: data.Username, Email: data.Email, PasswordHash: hash}
			if _, err := tx.NewInsert().Model(user).Returning("id").Exec(ctx); err != nil {
				return err
			}
		} else if errors.Is(err, sql.ErrNoRows) {
			return echo.NewHTTPError(404, "User not found; use Create user to provision a login")
		}
		exists, err := tx.NewSelect().Model((*database.OrganizationMember)(nil)).
			Where("organization_id = ? AND user_id = ?", organizationID, user.ID).Exists(ctx)
		if err != nil {
			return err
		}
		if exists {
			return echo.NewHTTPError(409, "User already has organization access")
		}
		member := &database.OrganizationMember{OrganizationID: organizationID, UserID: user.ID, Role: data.Role}
		if _, err := tx.NewInsert().Model(member).Returning("id").Exec(ctx); err != nil {
			return err
		}
		member.User = user
		result = publicMember(member)
		return nil
	})
	return result, err
}

func (s *Service) ChangeAccess(ctx context.Context, organizationID string, actorID, memberID int64, role string, remove bool) error {
	return s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		// Serializes all role changes so concurrent demotions cannot remove the last admin.
		if err := organizationquery.Lock(ctx, tx, organizationID, true); err != nil {
			return err
		}
		if err := organizationquery.RequireAdmin(ctx, tx, organizationID, actorID); err != nil {
			return err
		}
		member := new(database.OrganizationMember)
		err := tx.NewSelect().Model(member).Where("id = ? AND organization_id = ?", memberID, organizationID).Scan(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			return echo.NewHTTPError(404, "Organization member not found")
		}
		if err != nil {
			return err
		}
		if member.Role == "ADMIN" && (remove || role != "ADMIN") {
			count, err := tx.NewSelect().Model((*database.OrganizationMember)(nil)).
				Where("organization_id = ? AND role = ? AND user_id <> ?", organizationID, "ADMIN", member.UserID).Count(ctx)
			if err != nil {
				return err
			}
			if count == 0 {
				return echo.NewHTTPError(409, "The last organization administrator cannot be removed or demoted")
			}
		}
		if remove {
			if _, err := tx.NewDelete().Model((*database.Token)(nil)).
				Where("organization_id = ? AND user_id = ?", organizationID, member.UserID).Exec(ctx); err != nil {
				return err
			}
			_, err = tx.NewDelete().Model(member).WherePK().Exec(ctx)
		} else {
			_, err = tx.NewUpdate().Model(member).Set("role = ?", role).WherePK().Exec(ctx)
		}
		return err
	})
}

func (s *Service) ChangePassword(ctx context.Context, organizationID string, actorID, memberID int64, password string) error {
	if len(password) < 12 || len(password) > 72 {
		return echo.NewHTTPError(400, "Password must contain 12–72 bytes")
	}
	return s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if err := organizationquery.Lock(ctx, tx, organizationID, true); err != nil {
			return err
		}
		if err := organizationquery.RequireAdmin(ctx, tx, organizationID, actorID); err != nil {
			return err
		}
		// Organization membership does not authorize changing a global account.
		actor := new(database.User)
		if err := tx.NewSelect().Model(actor).Where("id = ?", actorID).For("SHARE").Scan(ctx); err != nil {
			return err
		}
		if !actor.IsAdmin {
			return echo.NewHTTPError(403, "Only instance administrators can change user passwords")
		}
		member := new(database.OrganizationMember)
		err := tx.NewSelect().Model(member).Where("id = ? AND organization_id = ?", memberID, organizationID).Scan(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			return echo.NewHTTPError(404, "Organization member not found")
		}
		if err != nil {
			return err
		}
		user := new(database.User)
		if err := tx.NewSelect().Model(user).Where("id = ?", member.UserID).For("UPDATE").Scan(ctx); err != nil {
			return err
		}
		// A password belongs to the account, not just this organization's membership.
		admin, err := tx.NewSelect().Model((*database.OrganizationMember)(nil)).
			Where("user_id = ? AND role = ?", user.ID, "ADMIN").Exists(ctx)
		if err != nil {
			return err
		}
		if user.IsAdmin || admin {
			return echo.NewHTTPError(403, "Administrator passwords cannot be changed from Team")
		}
		if user.AuthProvider != "" || user.AuthID != "" {
			return echo.NewHTTPError(400, "This account uses an external login provider")
		}
		hash, err := crypt.HashPassword(password)
		if err != nil {
			return err
		}
		if _, err := tx.NewUpdate().Model(user).Set("password_hash = ?", hash).WherePK().Exec(ctx); err != nil {
			return err
		}
		_, err = tx.NewDelete().Model((*database.Session)(nil)).Where("user_id = ?", user.ID).Exec(ctx)
		return err
	})
}
