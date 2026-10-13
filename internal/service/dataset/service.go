package dataset

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/fivemanage/lite/api"
	"github.com/fivemanage/lite/internal/clickhouse"
	"github.com/fivemanage/lite/internal/crypt"
	"github.com/fivemanage/lite/internal/database"
	datasetquery "github.com/fivemanage/lite/internal/database/query/dataset"
	organizationquery "github.com/fivemanage/lite/internal/database/query/organization"
	"github.com/labstack/echo/v4"
	"github.com/uptrace/bun"
)

type Service struct {
	db *bun.DB
	ch *clickhouse.Client
}

func NewService(db *bun.DB, clickhouseClient *clickhouse.Client) *Service {
	return &Service{
		db: db,
		ch: clickhouseClient,
	}
}

func (r *Service) Create(ctx context.Context, orgID string, data api.CreateDatasetSchema) (*api.Dataset, error) {
	datasetID, err := crypt.GeneratePrimaryKey()
	if err != nil {
		return nil, err
	}

	dbDataset := &database.Dataset{
		ID:             datasetID,
		Name:           data.Name,
		Description:    data.Description,
		RetentionDays:  data.RetentionDays,
		OrganizationID: orgID,
	}

	err = r.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if err := organizationquery.Lock(ctx, tx, orgID, false); err != nil {
			return err
		}
		return datasetquery.Insert(ctx, tx, dbDataset)
	})
	if err != nil {
		return nil, err
	}

	return &api.Dataset{
		ID:             dbDataset.ID,
		Name:           dbDataset.Name,
		Description:    dbDataset.Description,
		RetentionDays:  dbDataset.RetentionDays,
		OrganizationID: orgID,
	}, nil
}

func (r *Service) GetLog(ctx context.Context, organizationID, datasetID, logID string) (*api.DatasetLog, error) {
	fmt.Println(organizationID, datasetID, logID)
	log, err := r.ch.QueryLog(ctx, organizationID, datasetID, logID)
	if err != nil {
		return nil, err
	}

	return log, nil
}

func (r *Service) List(ctx context.Context, organizationID string) ([]api.Dataset, error) {
	datasets := make([]api.Dataset, 0)

	dbDatasets, err := datasetquery.List(ctx, r.db, organizationID)
	if err != nil {
		return nil, err
	}

	for _, dbDataset := range dbDatasets {
		dataset := api.Dataset{
			ID:             dbDataset.ID,
			Name:           dbDataset.Name,
			Description:    dbDataset.Description,
			RetentionDays:  dbDataset.RetentionDays,
			OrganizationID: dbDataset.OrganizationID,
		}

		datasets = append(datasets, dataset)
	}
	return datasets, nil
}

// Delete removes stored rows before metadata. On storage failure, metadata remains
// so administrators can retry; already completed ClickHouse mutations are irreversible.
func (r *Service) Delete(ctx context.Context, orgID, datasetID string, userID int64) error {
	return r.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if err := organizationquery.Lock(ctx, tx, orgID, false); err != nil {
			return err
		}
		if err := organizationquery.RequireAdmin(ctx, tx, orgID, userID); err != nil {
			return err
		}
		if _, err := datasetquery.SelectForUpdate(ctx, tx, orgID, datasetID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return echo.NewHTTPError(404, "Dataset not found")
			}
			return err
		}
		if err := r.ch.DeleteDatasetData(ctx, orgID, datasetID); err != nil {
			return err
		}
		// Tokens belong to the organization, not individual datasets.
		return datasetquery.Delete(ctx, tx, orgID, datasetID)
	})
}

// DeleteOrganizationData also removes orphaned rows. The caller must hold an
// exclusive organization row lock until its metadata deletion transaction commits.
func (r *Service) DeleteOrganizationData(ctx context.Context, orgID string) error {
	return r.ch.DeleteOrganizationData(ctx, orgID)
}

func (r *Service) ListFields(ctx context.Context, organizationID, datasetID string) ([]api.DatasetField, error) {
	logKeys, err := r.ch.QueryLogFields(ctx, organizationID, datasetID)
	if err != nil {
		return nil, err
	}

	fields := make([]api.DatasetField, len(logKeys))
	for i, key := range logKeys {
		fields[i] = api.DatasetField{
			Field: key.Field,
			Type:  key.Type,
		}
	}

	return fields, nil
}

func (r *Service) TotalLogs(ctx context.Context, organizationID, datasetID string) (int, error) {
	return r.ch.QueryTotalLogs(ctx, organizationID, datasetID)
}

func (r *Service) QueryLogs(
	ctx context.Context,
	organizationID,
	datasetID string,
	startTime,
	endTime string,
	filter string,
	cursor int,
) ([]api.DatasetLog, error) {
	filterObj := api.DatasetFilter{}

	if len(filter) != 0 {
		if err := json.Unmarshal([]byte(filter), &filterObj); err != nil {
			fmt.Println(err)
			return nil, err
		}
	}

	toDateTime, err := time.Parse(time.RFC1123, endTime)
	if err != nil {
		return nil, err
	}
	fromDateTime, err := time.Parse(time.RFC1123, startTime)
	if err != nil {
		return nil, err
	}

	logs, err := r.ch.QueryLogs(ctx, organizationID, datasetID, fromDateTime, toDateTime, filterObj, cursor)
	if err != nil {
		return nil, err
	}

	return logs, nil
}
