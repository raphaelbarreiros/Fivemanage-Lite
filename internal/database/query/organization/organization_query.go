package organizationquery

import (
	"context"
	"database/sql"
	"errors"

	"github.com/fivemanage/lite/api"
	"github.com/fivemanage/lite/internal/database"
	"github.com/labstack/echo/v4"
	"github.com/uptrace/bun"
)

func Find(ctx context.Context, db *bun.DB, ID string) (*database.Organization, error) {
	organization := new(database.Organization)
	err := db.NewSelect().Model(organization).Where("id = ?", ID).Scan(ctx)
	if err != nil {
		return nil, err
	}

	return organization, nil
}

func List(ctx context.Context, db *bun.DB, userID int64) ([]*api.Organization, error) {
	organizations := make([]*api.Organization, 0)
	err := db.NewSelect().TableExpr("organization AS o").
		ColumnExpr("o.id, o.name, m.role").
		Join("JOIN organization_member AS m ON m.organization_id = o.id").
		Where("m.user_id = ?", userID).
		OrderExpr("o.name ASC, o.id ASC").Scan(ctx, &organizations)
	return organizations, err
}

func ListMembers(ctx context.Context, db *bun.DB, organizationID string) ([]database.OrganizationMember, error) {
	var members []database.OrganizationMember

	err := db.NewSelect().
		Model(&members).
		Relation("User").
		Where("organization_id = ?", organizationID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return members, nil
}

// Lock keeps organization deletion mutually exclusive with writes, across replicas.
// The caller must hold the transaction until its external storage writes finish.
func Lock(ctx context.Context, tx bun.Tx, organizationID string, exclusive bool) error {
	mode := "SHARE"
	if exclusive {
		mode = "UPDATE"
	}
	organization := new(database.Organization)
	err := tx.NewSelect().Model(organization).Where("id = ?", organizationID).For(mode).Scan(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return echo.NewHTTPError(404, "Organization not found")
	}
	return err
}

func MemberRole(ctx context.Context, db bun.IDB, organizationID string, userID int64) (string, error) {
	member := new(database.OrganizationMember)
	err := db.NewSelect().Model(member).Column("role").
		Where("organization_id = ? AND user_id = ?", organizationID, userID).Scan(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return "", echo.NewHTTPError(403, "Organization access denied")
	}
	return member.Role, err
}

func RequireAdmin(ctx context.Context, db bun.IDB, organizationID string, userID int64) error {
	role, err := MemberRole(ctx, db, organizationID, userID)
	if err != nil {
		return err
	}
	if role != "ADMIN" {
		return echo.NewHTTPError(403, "Organization administrator access required")
	}
	return nil
}
