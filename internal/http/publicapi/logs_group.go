package publicapi

import (
	"errors"

	"github.com/fivemanage/lite/api"
	"github.com/fivemanage/lite/internal/auth"
	"github.com/fivemanage/lite/internal/http/httputil"
	"github.com/fivemanage/lite/internal/http/middleware"
	"github.com/fivemanage/lite/internal/service/log"
	"github.com/fivemanage/lite/internal/service/token"
	"github.com/fivemanage/lite/pkg/cache"
	"github.com/labstack/echo/v4"
)

func registerLogsApi(
	group *echo.Group,
	logService *log.Service,
	tokenService *token.Service,
	cache *cache.Cache,
) {
	h := &logsHandler{
		logService: logService,
	}
	group.POST("/logs", h.submitLogs, middleware.TokenAuth(tokenService, cache))
}

type logsHandler struct {
	logService *log.Service
}

// submitLogs godoc
// @Summary      Submit logs
// @Description  Submit multiple log entries for a dataset
// @Tags         public
// @Accept       json
// @Produce      json
// @Param        X-Fivemanage-Dataset  header    string    false  "Dataset name"
// @Param        logs                  body      []api.Log  true   "Logs to submit"
// @Success      200                   {object}  httputil.ResponseData{data=string}
// @Failure      401                   {object}  httputil.ErrorResponseData
// @Failure      404                   {object}  httputil.ErrorResponseData
// @Failure      503                   {object}  httputil.ErrorResponseData
// @Router       /logs [post]
func (h *logsHandler) submitLogs(c echo.Context) error {
	ctx := c.Request().Context()
	dataset := c.Request().Header.Get("X-Fivemanage-Dataset")

	orgID, err := auth.CurrentOrgId(c)
	if err != nil {
		return err
	}

	var logs []api.Log
	if err := c.Bind(&logs); err != nil {
		return err
	}

	if err := h.logService.SubmitLogs(ctx, orgID, dataset, logs); err != nil {
		var httpErr *echo.HTTPError
		if errors.As(err, &httpErr) && httpErr.Code == 404 {
			return c.JSON(404, httputil.ErrorResponse("dataset not found"))
		}
		return c.JSON(503, httputil.ErrorResponse("log storage unavailable"))
	}

	c.Response().Header().Set("X-Fivemanage-Ingest", "clickhouse-sync-v1")
	return c.JSON(200, httputil.Response("ok"))
}
