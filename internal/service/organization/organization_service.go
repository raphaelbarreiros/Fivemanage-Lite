package organization

import (
	"context"
	"strings"
	"unicode/utf8"

	"github.com/fivemanage/lite/api"
	"github.com/fivemanage/lite/internal/clickhouse"
	"github.com/fivemanage/lite/internal/crypt"
	"github.com/fivemanage/lite/internal/database"
	datasetquery "github.com/fivemanage/lite/internal/database/query/dataset"
	filequery "github.com/fivemanage/lite/internal/database/query/file"
	organizationquery "github.com/fivemanage/lite/internal/database/query/organization"
	tokenquery "github.com/fivemanage/lite/internal/database/query/token"
	"github.com/fivemanage/lite/internal/service/dataset"
	"github.com/fivemanage/lite/pkg/storage"
	"github.com/labstack/echo/v4"
	"github.com/uptrace/bun"
)

type Service struct {
	db       *bun.DB
	ch       *clickhouse.Client
	datasets *dataset.Service
	storage  storage.StorageLayer
}

func NewService(db *bun.DB, ch *clickhouse.Client, datasets *dataset.Service, storageLayer storage.StorageLayer) *Service {
	return &Service{db: db, ch: ch, datasets: datasets, storage: storageLayer}
}

func (r *Service) GetStats(ctx context.Context, organizationID string) (*api.OrganizationStats, error) {
	totalFiles, err := filequery.FindTotalStorageCount(ctx, r.db, organizationID)
	if err != nil {
		return nil, err
	}

	totalSize, err := filequery.FindTotalStorageSize(ctx, r.db, organizationID)
	if err != nil {
		return nil, err
	}

	totalLogs, err := r.ch.QueryTotalLogsByOrg(ctx, organizationID)
	if err != nil {
		return nil, err
	}

	tokens, err := tokenquery.List(ctx, r.db, organizationID)
	if err != nil {
		return nil, err
	}

	datasets, err := datasetquery.List(ctx, r.db, organizationID)
	if err != nil {
		return nil, err
	}

	return &api.OrganizationStats{
		TotalFiles:   totalFiles,
		TotalSize:    totalSize,
		TotalLogs:    totalLogs,
		TotalTokens:  len(tokens),
		TotalDataset: len(datasets),
	}, nil
}

func (r *Service) CreateOrganization(ctx context.Context, data *api.CreateOrganizationRequest, userID int64) (*api.Organization, error) {
	name := strings.TrimSpace(data.Name)
	if name == "" || utf8.RuneCountInString(name) > 100 {
		return nil, echo.NewHTTPError(400, "Organization name must contain 1–100 characters")
	}
	id, err := crypt.GeneratePrimaryKey()
	if err != nil {
		return nil, err
	}
	org := &database.Organization{ID: id, Name: name}
	err = r.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewInsert().Model(org).Exec(ctx); err != nil {
			return err
		}
		_, err := tx.NewInsert().Model(&database.OrganizationMember{
			Role: "ADMIN", OrganizationID: id, UserID: userID,
		}).Exec(ctx)
		return err
	})
	if err != nil {
		return nil, err
	}
	return &api.Organization{ID: id, Name: name, Role: "ADMIN"}, nil
}

func (r *Service) FindOrganizationByID(ctx context.Context, ID string, userID int64) (*api.Organization, error) {
	dbOrganization, err := organizationquery.Find(ctx, r.db, ID)
	if err != nil {
		return nil, err
	}
	role, err := organizationquery.MemberRole(ctx, r.db, ID, userID)
	if err != nil {
		return nil, err
	}

	organization := &api.Organization{
		ID:   dbOrganization.ID,
		Name: dbOrganization.Name,
		Role: role,
	}

	return organization, nil
}

func (r *Service) ListOrganizations(ctx context.Context, userID int64) ([]*api.Organization, error) {
	return organizationquery.List(ctx, r.db, userID)
}

func (r *Service) Rename(ctx context.Context, organizationID string, userID int64, name string) (*api.Organization, error) {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > 100 {
		return nil, echo.NewHTTPError(400, "Organization name must contain 1–100 characters")
	}
	err := r.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if err := organizationquery.Lock(ctx, tx, organizationID, true); err != nil {
			return err
		}
		if err := organizationquery.RequireAdmin(ctx, tx, organizationID, userID); err != nil {
			return err
		}
		_, err := tx.NewUpdate().Model((*database.Organization)(nil)).
			Set("name = ?", name).Where("id = ?", organizationID).Exec(ctx)
		return err
	})
	if err != nil {
		return nil, err
	}
	return &api.Organization{ID: organizationID, Name: name, Role: "ADMIN"}, nil
}

func (r *Service) Delete(ctx context.Context, organizationID string, userID int64, confirmation string) error {
	return r.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if err := organizationquery.Lock(ctx, tx, organizationID, true); err != nil {
			return err
		}
		if err := organizationquery.RequireAdmin(ctx, tx, organizationID, userID); err != nil {
			return err
		}
		org := new(database.Organization)
		if err := tx.NewSelect().Model(org).Where("id = ?", organizationID).Scan(ctx); err != nil {
			return err
		}
		if confirmation != org.Name {
			return echo.NewHTTPError(400, "Organization name confirmation does not match")
		}
		var keys []string
		if err := tx.NewSelect().Model((*database.Asset)(nil)).Column("key").
			Where("organization_id = ?", organizationID).Distinct().Scan(ctx, &keys); err != nil {
			return err
		}
		if len(keys) > 0 && r.storage == nil {
			return echo.NewHTTPError(503, "File storage must be configured before deleting this organization")
		}
		// External deletion is irreversible. Keep all relational metadata on failure
		// so the administrator can retry the same operation safely.
		if err := r.datasets.DeleteOrganizationData(ctx, organizationID); err != nil {
			return err
		}
		for _, key := range keys {
			if err := r.storage.DeleteFile(ctx, key); err != nil {
				return err
			}
		}
		for _, model := range []any{
			(*database.Asset)(nil), (*database.Dataset)(nil),
			(*database.Token)(nil), (*database.OrganizationMember)(nil),
		} {
			if _, err := tx.NewDelete().Model(model).Where("organization_id = ?", organizationID).Exec(ctx); err != nil {
				return err
			}
		}
		_, err := tx.NewDelete().Model(org).WherePK().Exec(ctx)
		return err
	})
}
