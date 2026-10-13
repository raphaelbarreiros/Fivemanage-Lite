package dataset

import (
	"context"

	"github.com/fivemanage/lite/internal/database"
	"github.com/uptrace/bun"
)

func Insert(ctx context.Context, db bun.IDB, dataset *database.Dataset) error {
	_, err := db.NewInsert().Model(dataset).Exec(ctx)
	if err != nil {
		return err
	}

	return nil
}

func List(ctx context.Context, db *bun.DB, orgID string) ([]database.Dataset, error) {
	var datasets []database.Dataset

	err := db.NewSelect().Model(&datasets).
		Where("organization_id = ?", orgID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return datasets, nil
}

func SelectByNameForShare(ctx context.Context, db bun.IDB, orgID string, datasetName string) (*database.Dataset, error) {
	var dataset database.Dataset

	err := db.NewSelect().Model(&dataset).
		Where("organization_id = ?", orgID).
		Where("name = ?", datasetName).
		For("SHARE").
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return &dataset, nil
}

func Delete(ctx context.Context, db bun.IDB, orgID string, datasetID string) error {
	_, err := db.NewDelete().Model((*database.Dataset)(nil)).
		Where("organization_id = ?", orgID).
		Where("id = ?", datasetID).
		Exec(ctx)
	if err != nil {
		return err
	}

	return nil
}

func SelectForUpdate(ctx context.Context, db bun.IDB, orgID, datasetID string) (*database.Dataset, error) {
	var dataset database.Dataset
	err := db.NewSelect().Model(&dataset).
		Where("organization_id = ?", orgID).
		Where("id = ?", datasetID).
		For("UPDATE").
		Scan(ctx)
	return &dataset, err
}
