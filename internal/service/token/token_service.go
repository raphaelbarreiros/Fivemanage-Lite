package token

import (
	"context"
	"os"
	"strconv"

	"github.com/fivemanage/lite/api"
	"github.com/fivemanage/lite/internal/crypt"
	"github.com/fivemanage/lite/internal/database"
	tokenquery "github.com/fivemanage/lite/internal/database/query/token"
	"github.com/labstack/echo/v4"
	"github.com/uptrace/bun"
	"github.com/uptrace/opentelemetry-go-extra/otelzap"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.uber.org/zap"
)

var tracer = otel.Tracer("github.com/fivemanage/lite/internal/service/token")

type Service struct {
	db *bun.DB
}

func NewService(db *bun.DB) *Service {
	return &Service{
		db: db,
	}
}

func (r *Service) GetToken(ctx context.Context, apiToken string) (*database.Token, error) {
	// we need to add this check to the env check in cmd/lite/lite.go
	hmacSecret := os.Getenv("API_TOKEN_HMAC_SECRET")
	tokenHash := crypt.ComputeHMAC(hmacSecret, apiToken)

	token, err := tokenquery.SelectByHash(ctx, r.db, tokenHash)
	if err != nil {
		return nil, err
	}

	return token, nil
}

func (r *Service) CreateToken(ctx context.Context, data *api.CreateTokenRequest, userID int64) (string, error) {
	apiToken, err := crypt.GenerateApiKey()
	if err != nil {
		return "", err
	}

	hmacSecret := os.Getenv("API_TOKEN_HMAC_SECRET")
	tokenHash := crypt.ComputeHMAC(hmacSecret, apiToken)

	token := &database.Token{
		OrganizationID: data.OrganizationID,
		Identifier:     data.Identifier,
		TokenHash:      tokenHash,
		UserID:         int(userID),
	}

	err = tokenquery.Create(ctx, r.db, token)
	if err != nil {
		return "", err
	}

	return apiToken, nil
}

func (r *Service) ListTokens(ctx context.Context, organizationID string) ([]*api.ListTokensResponse, error) {
	var err error
	response := make([]*api.ListTokensResponse, 0)

	ctx, span := tracer.Start(ctx, "token.list_tokens")
	defer span.End()

	tokens, err := tokenquery.List(ctx, r.db, organizationID)
	if err != nil {
		span.RecordError(err)
		otelzap.L().Error("failed to list tokens", zap.Error(err))
		return nil, err
	}

	for _, token := range tokens {
		response = append(response, &api.ListTokensResponse{
			ID:         token.ID,
			Identifier: token.Identifier,
		})
	}

	span.SetAttributes(
		attribute.Int("token_count", len(tokens)),
	)

	otelzap.L().Debug("listed tokens successfully", zap.Int("count", len(tokens)))

	return response, nil
}

func (r *Service) DeleteToken(ctx context.Context, organizationID, tokenID string, userID int64) error {
	id, err := strconv.ParseInt(tokenID, 10, 64)
	if err != nil || id < 1 {
		return echo.NewHTTPError(400, "Invalid token ID")
	}
	return tokenquery.Delete(ctx, r.db, organizationID, userID, id)
}

func (r *Service) IsTokenActive(ctx context.Context, token *database.Token) (bool, error) {
	return r.db.NewSelect().Model((*database.Token)(nil)).
		Where("id = ? AND organization_id = ?", token.ID, token.OrganizationID).
		Where("EXISTS (SELECT 1 FROM organization WHERE id = token.organization_id)").Exists(ctx)
}
