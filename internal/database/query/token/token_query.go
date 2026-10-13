package tokenquery

import (
	"context"

	"github.com/fivemanage/lite/internal/database"
	organizationquery "github.com/fivemanage/lite/internal/database/query/organization"
	"github.com/labstack/echo/v4"
	"github.com/uptrace/bun"
)

func SelectByHash(ctx context.Context, db *bun.DB, tokenHash string) (*database.Token, error) {
	var token database.Token

	err := db.NewSelect().Model(&token).Where("token_hash = ?", tokenHash).
		Where("EXISTS (SELECT 1 FROM organization WHERE id = token.organization_id)").Scan(ctx)
	if err != nil {
		return nil, err
	}

	return &token, nil
}

func Create(ctx context.Context, db *bun.DB, token *database.Token) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if err := organizationquery.Lock(ctx, tx, token.OrganizationID, false); err != nil {
			return err
		}
		if _, err := organizationquery.MemberRole(ctx, tx, token.OrganizationID, int64(token.UserID)); err != nil {
			return err
		}
		_, err := tx.NewInsert().Model(token).Exec(ctx)
		return err
	})
}

func List(ctx context.Context, db *bun.DB, organizationID string) ([]database.Token, error) {
	var tokens []database.Token

	err := db.NewSelect().
		Model(&tokens).
		Where("organization_id = ?", organizationID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return tokens, nil
}

func Delete(ctx context.Context, db *bun.DB, organizationID string, userID, tokenID int64) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if err := organizationquery.Lock(ctx, tx, organizationID, false); err != nil {
			return err
		}
		if _, err := organizationquery.MemberRole(ctx, tx, organizationID, userID); err != nil {
			return err
		}
		result, err := tx.NewDelete().Model((*database.Token)(nil)).
			Where("id = ? AND organization_id = ?", tokenID, organizationID).Exec(ctx)
		if err != nil {
			return err
		}
		count, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if count == 0 {
			return echo.NewHTTPError(404, "Token not found in organization")
		}
		return nil
	})
}
