package clickhouse

import (
	"context"
	"fmt"

	"github.com/ClickHouse/clickhouse-go/v2"
)

func (c *Client) DeleteDatasetData(ctx context.Context, organizationID, datasetID string) error {
	return c.deleteData(ctx, organizationID, datasetID)
}

func (c *Client) DeleteOrganizationData(ctx context.Context, organizationID string) error {
	return c.deleteData(ctx, organizationID, "")
}

func (c *Client) deleteData(ctx context.Context, organizationID, datasetID string) error {
	if c == nil || !c.Enabled || c.conn == nil {
		return fmt.Errorf("ClickHouse is unavailable; stored logs cannot be deleted")
	}

	parameters := clickhouse.Parameters{"TeamId": organizationID}
	predicate := "TeamId = {TeamId:String}"
	if datasetID != "" {
		parameters["DatasetId"] = datasetID
		predicate += " AND DatasetId = {DatasetId:String}"
	}
	chCtx := clickhouse.Context(ctx, clickhouse.WithParameters(parameters))

	// These tables are shared by every tenant; dropping one would delete other
	// datasets. Mutations do not cascade through materialized views, so remove
	// each destination explicitly and wait for completion before deleting metadata.
	for _, table := range []string{"logs", "log_attributes", "log_key_values", "log_keys", "default.otel_traces"} {
		query := "ALTER TABLE " + table + " DELETE WHERE " + predicate + " SETTINGS mutations_sync = 2"
		if err := c.conn.Exec(chCtx, query); err != nil {
			return fmt.Errorf("delete stored logs from %s: %w", table, err)
		}
	}
	return nil
}
