package filequery

import (
	"context"
	"database/sql"
	"errors"

	"github.com/fivemanage/lite/internal/database"
	organizationquery "github.com/fivemanage/lite/internal/database/query/organization"
	"github.com/uptrace/bun"
)

// todo: rename to Insert
func Create(ctx context.Context, db *bun.DB, file *database.Asset) (bun.Tx, error) {
	var err error

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return tx, err
	}
	if err := organizationquery.Lock(ctx, tx, file.OrganizationID, false); err != nil {
		_ = tx.Rollback()
		return tx, err
	}

	_, err = tx.NewInsert().Model(file).Exec(ctx)
	if err != nil {
		_ = tx.Rollback()
		return tx, err
	}

	return tx, nil
}

func FindFileByID(ctx context.Context, db *bun.DB, organizationID, id string) (*database.Asset, error) {
	var file database.Asset
	err := db.NewSelect().
		Model(&file).
		Where("organization_id = ?", organizationID).
		Where("id = ?", id).
		Limit(1).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &file, nil
}

func FindStorageFiles(ctx context.Context, db *bun.DB, organizationID, search, fileType string, page, pageSize int) ([]*database.Asset, error) {
	var files []*database.Asset

	// no, this does not scale at all, but...soonTM
	// we are also missing indexes I need to create migrations for
	sb := db.NewSelect().
		Model(&files).
		Where("organization_id = ?", organizationID).
		Order("created_at DESC")

	if search != "" {
		// not my proudest moment
		sb = sb.Where("key LIKE ?", "%"+search+"%")
	}

	if fileType != "" && fileType != "all" {
		sb = sb.Where("type = ?", fileType)
	}

	if pageSize > 0 {
		sb = sb.Limit(pageSize).Offset(page * pageSize)
	}

	err := sb.Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return files, nil
}

func FindTotalStorageCount(ctx context.Context, db *bun.DB, organizationID string) (int, error) {
	count, err := db.NewSelect().
		Model((*database.Asset)(nil)).
		Where("organization_id = ?", organizationID).
		Count(ctx)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func FindTotalStorageSize(ctx context.Context, db *bun.DB, organizationID string) (int64, error) {
	var size int64
	err := db.NewSelect().
		Model((*database.Asset)(nil)).
		ColumnExpr("COALESCE(SUM(size), 0)").
		Where("organization_id = ?", organizationID).
		Scan(ctx, &size)
	if err != nil {
		return 0, err
	}

	return size, nil
}
