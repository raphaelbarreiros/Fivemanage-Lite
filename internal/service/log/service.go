package log

import (
	"context"
	"database/sql"
	"errors"
	"maps"
	"time"

	"github.com/fivemanage/lite/api"
	"github.com/fivemanage/lite/internal/clickhouse"
	"github.com/fivemanage/lite/internal/crypt"
	datasetquery "github.com/fivemanage/lite/internal/database/query/dataset"
	organizationquery "github.com/fivemanage/lite/internal/database/query/organization"
	"github.com/labstack/echo/v4"
	"github.com/uptrace/bun"
)

type Service struct {
	db               *bun.DB
	clickhouseClient *clickhouse.Client
}

func NewService(db *bun.DB, clickhouseClient *clickhouse.Client) *Service {
	return &Service{
		db:               db,
		clickhouseClient: clickhouseClient,
	}
}

func (r *Service) SubmitLogs(ctx context.Context, organizationID string, datasetName string, logs []api.Log) error {
	if datasetName == "" {
		datasetName = "default"
	}
	return r.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if err := organizationquery.Lock(ctx, tx, organizationID, false); err != nil {
			return err
		}
		dataset, err := datasetquery.SelectByNameForShare(ctx, tx, organizationID, datasetName)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return echo.NewHTTPError(404, "Dataset not found")
			}
			return err
		}

		clickhouseLogs := make([]*clickhouse.Log, 0, len(logs))
		for _, log := range logs {
			traceID, err := crypt.GeneratePrimaryKey()
			if err != nil {
				return err
			}

			metadata := make(map[string]string)
			for k, v := range log.Metadata {
				maps.Copy(metadata, buildLogAttributes(k, v, 0))
			}

			logMessage := formatMessage(log.Message)
			metadata["message"] = logMessage
			metadata["severity"] = log.Level
			metadata["_resource"] = log.Resource

			clickhouseLogs = append(clickhouseLogs, &clickhouse.Log{
				TraceID:       traceID,
				Timestamp:     time.Now().UTC(),
				TeamID:        organizationID,
				DatasetID:     dataset.ID,
				Body:          logMessage,
				Attributes:    metadata,
				RetentionDays: 30,
			})
		}

		// Keep both shared row locks until ClickHouse accepts the batch, so a
		// concurrent deletion cannot finish before this in-flight write.
		return r.clickhouseClient.BatchWriteLogRows(ctx, clickhouseLogs)
	})
}
