package organization

import (
	"github.com/fivemanage/lite/api"
	"github.com/fivemanage/lite/internal/http/appctx"
	"github.com/fivemanage/lite/internal/http/httputil"
	"github.com/fivemanage/lite/internal/http/validator"
	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
)

// createOrganizationHandler godoc
// @Summary      Create organization
// @Description  Create a new organization
// @Tags         organization
// @Accept       json
// @Produce      json
// @Param        data  body      api.CreateOrganizationRequest  true  "Create Organization Request"
// @Success      200   {object}  httputil.ResponseData{data=api.Organization}
// @Failure      500   {object}  httputil.ErrorResponseData
// @Router       /dash/organization [post]
func (r *handler) createOrganizationHandler(c echo.Context) error {
	cc := c.(*appctx.Context)
	ctx := cc.Request().Context()

	var data api.CreateOrganizationRequest
	if err := validator.BindAndValidate(cc, &data); err != nil {
		logrus.WithError(err).Error("failed to bind and validate token")
		return cc.JSON(400, httputil.ErrorResponse(err.Error()))
	}

	user := cc.User()

	organization, err := r.organizationService.CreateOrganization(ctx, &data, user.ID)
	if err != nil {
		logrus.WithError(err).Error("failed to create organization")
		return err
	}

	return cc.JSON(200, httputil.Response(organization))
}

// listOrganizationsHandler godoc
// @Summary      List organizations
// @Description  List organizations accessible to the current user
// @Tags         organization
// @Produce      json
// @Success      200  {object}  httputil.ResponseData{data=[]api.Organization}
// @Failure      500  {object}  httputil.ErrorResponseData
// @Router       /dash/organization [get]
func (r *handler) listOrganizationsHandler(c echo.Context) error {
	cc := c.(*appctx.Context)
	ctx := cc.Request().Context()

	organizations, err := r.organizationService.ListOrganizations(ctx, cc.User().ID)
	if err != nil {
		logrus.WithError(err).Error("failed to list organizations")
		return cc.JSON(500, httputil.ErrorResponse(err.Error()))
	}

	return cc.JSON(200, httputil.Response(organizations))
}

// getOrganizationHandler godoc
// @Summary      Get organization
// @Description  Get organization by ID
// @Tags         organization
// @Produce      json
// @Param        organizationId   path      string  true  "Organization ID"
// @Success      200  {object}  httputil.ResponseData{data=api.Organization}
// @Failure      500  {object}  httputil.ErrorResponseData
// @Router       /dash/organization/{organizationId} [get]
func (r *handler) getOrganizationHandler(c echo.Context) error {
	cc := c.(*appctx.Context)
	ctx := cc.Request().Context()

	id := cc.Param("organizationId")

	organization, err := r.organizationService.FindOrganizationByID(ctx, id, cc.User().ID)
	if err != nil {
		logrus.WithError(err).Error("failed to find organization")
		return err
	}

	return cc.JSON(200, httputil.Response(organization))
}

// getOrganizationStatsHandler godoc
// @Summary      Get organization stats
// @Description  Get statistics for an organization
// @Tags         organization
// @Produce      json
// @Param        organizationId   path      string  true  "Organization ID"
// @Success      200  {object}  httputil.ResponseData{data=api.OrganizationStats}
// @Failure      500  {object}  httputil.ErrorResponseData
// @Router       /dash/organization/{organizationId}/stats [get]
func (r *handler) getOrganizationStatsHandler(c echo.Context) error {
	cc := c.(*appctx.Context)
	ctx := cc.Request().Context()

	id := cc.Param("organizationId")

	stats, err := r.organizationService.GetStats(ctx, id)
	if err != nil {
		logrus.WithError(err).Error("failed to get organization stats")
		return cc.JSON(500, httputil.ErrorResponse(err.Error()))
	}

	return cc.JSON(200, httputil.Response(stats))
}

// renameOrganizationHandler godoc
// @Summary Rename organization (administrator only)
// @Tags organization
// @Accept json
// @Produce json
// @Param organizationId path string true "Organization ID"
// @Param data body api.CreateOrganizationRequest true "New name"
// @Success 200 {object} httputil.ResponseData{data=api.Organization}
// @Failure 400 {object} httputil.ErrorResponseData
// @Failure 403 {object} httputil.ErrorResponseData
// @Router /dash/organization/{organizationId} [patch]
func (r *handler) renameOrganizationHandler(c echo.Context) error {
	cc := c.(*appctx.Context)
	var data api.CreateOrganizationRequest
	if err := validator.BindAndValidate(cc, &data); err != nil {
		return cc.JSON(400, httputil.ErrorResponse(err.Error()))
	}
	organization, err := r.organizationService.Rename(cc.Request().Context(), cc.Param("organizationId"), cc.User().ID, data.Name)
	if err != nil {
		return err
	}
	return cc.JSON(200, httputil.Response(organization))
}

// deleteOrganizationHandler godoc
// @Summary Permanently delete organization and its data (administrator only)
// @Tags organization
// @Accept json
// @Param organizationId path string true "Organization ID"
// @Param data body api.DeleteOrganizationRequest true "Exact organization name confirmation"
// @Success 204
// @Failure 400 {object} httputil.ErrorResponseData
// @Failure 403 {object} httputil.ErrorResponseData
// @Router /dash/organization/{organizationId} [delete]
func (r *handler) deleteOrganizationHandler(c echo.Context) error {
	cc := c.(*appctx.Context)
	var data api.DeleteOrganizationRequest
	if err := validator.BindAndValidate(cc, &data); err != nil {
		return cc.JSON(400, httputil.ErrorResponse(err.Error()))
	}
	if err := r.organizationService.Delete(cc.Request().Context(), cc.Param("organizationId"), cc.User().ID, data.Name); err != nil {
		return err
	}
	return cc.NoContent(204)
}
