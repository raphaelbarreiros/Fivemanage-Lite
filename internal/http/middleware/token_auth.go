package middleware

import (
	"fmt"
	"time"

	internalauth "github.com/fivemanage/lite/internal/auth"
	"github.com/fivemanage/lite/internal/database"
	"github.com/fivemanage/lite/internal/service/token"
	"github.com/fivemanage/lite/pkg/cache"
	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
)

func TokenAuth(tokenService *token.Service, memcache *cache.Cache) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			var err error
			ctx := c.Request().Context()

			token := c.Request().Header.Get("Authorization")
			if token == "" {
				return c.JSON(401, echo.Map{
					"error": "Unauthorized: No token provided",
				})
			}

			var tokenData *database.Token

			key := fmt.Sprintf(cache.TokenCacheKey, token)
			tokenCacheData, found := memcache.Get(key)
			if !found {
				tokenData, err = tokenService.GetToken(ctx, token)
				if err != nil {
					logrus.WithField("error", err).Error("failed to get token from service")
					return c.JSON(401, echo.Map{
						"error": "Unauthorized: Invalid token",
					})
				}

				memcache.Set(key, tokenData, 5*time.Minute)

				c.Set(internalauth.OrgIDContextKey, tokenData.OrganizationID)
				c.Set("token_data", tokenData)
				return next(c)
			}

			tokenData, ok := tokenCacheData.(*database.Token)
			if !ok {
				logrus.Error("failed to assert token data from cache")
				return c.JSON(500, echo.Map{
					"error": "Internal server error",
				})
			}
			active, err := tokenService.IsTokenActive(ctx, tokenData)
			if err != nil {
				return c.JSON(500, echo.Map{"error": "Token authorization check failed"})
			}
			if !active {
				return c.JSON(401, echo.Map{"error": "Unauthorized: Token revoked"})
			}

			c.Set(internalauth.OrgIDContextKey, tokenData.OrganizationID)
			c.Set("token_data", tokenData)
			return next(c)
		}
	}
}
