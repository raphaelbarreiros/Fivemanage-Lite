package member

import (
	"strconv"

	"github.com/fivemanage/lite/api"
	"github.com/fivemanage/lite/internal/http/appctx"
	"github.com/fivemanage/lite/internal/http/httputil"
	"github.com/fivemanage/lite/internal/http/validator"
	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
)

// listMembersHandler godoc
// @Summary      List members
// @Description  List members of an organization
// @Tags         member
// @Produce      json
// @Param        organizationId   path      string  true  "Organization ID"
// @Success      200  {object}  httputil.ResponseData{data=[]api.OrganizationMember}
// @Failure      500  {object}  httputil.ErrorResponseData
// @Router       /dash/organization/{organizationId}/member [get]
func (r *handler) listMembersHandler(c echo.Context) error {
	cc := c.(*appctx.Context)
	ctx := cc.Request().Context()

	id := cc.Param("organizationId")

	members, err := r.memberService.ListMembers(ctx, id)
	if err != nil {
		logrus.WithError(err).Error("failed to list members")
		return cc.JSON(500, httputil.ErrorResponse(err.Error()))
	}

	return cc.JSON(200, httputil.Response(members))
}

// addMemberHandler godoc
// @Summary Grant access to an existing user or provision a login (administrator only)
// @Tags member
// @Accept json
// @Produce json
// @Param organizationId path string true "Organization ID"
// @Param data body api.AddOrganizationMemberRequest true "Member and optional new login"
// @Success 201 {object} httputil.ResponseData{data=api.OrganizationMember}
// @Failure 400 {object} httputil.ErrorResponseData
// @Failure 403 {object} httputil.ErrorResponseData
// @Failure 409 {object} httputil.ErrorResponseData
// @Router /dash/organization/{organizationId}/member [post]
func (r *handler) addMemberHandler(c echo.Context) error {
	cc := c.(*appctx.Context)
	var data api.AddOrganizationMemberRequest
	if err := validator.BindAndValidate(cc, &data); err != nil {
		return cc.JSON(400, httputil.ErrorResponse(err.Error()))
	}
	member, err := r.memberService.Add(cc.Request().Context(), cc.Param("organizationId"), cc.User().ID, &data)
	if err != nil {
		return err
	}
	return cc.JSON(201, httputil.Response(member))
}

// updateMemberHandler godoc
// @Summary Change organization role (administrator only)
// @Tags member
// @Accept json
// @Param organizationId path string true "Organization ID"
// @Param memberId path int true "Membership ID"
// @Param data body api.UpdateOrganizationMemberRequest true "New role"
// @Success 204
// @Failure 403 {object} httputil.ErrorResponseData
// @Failure 409 {object} httputil.ErrorResponseData
// @Router /dash/organization/{organizationId}/member/{memberId} [patch]
func (r *handler) updateMemberHandler(c echo.Context) error {
	cc := c.(*appctx.Context)
	id, err := strconv.ParseInt(cc.Param("memberId"), 10, 64)
	if err != nil || id < 1 {
		return echo.NewHTTPError(400, "Invalid member ID")
	}
	var data api.UpdateOrganizationMemberRequest
	if err := validator.BindAndValidate(cc, &data); err != nil {
		return cc.JSON(400, httputil.ErrorResponse(err.Error()))
	}
	if err := r.memberService.ChangeAccess(cc.Request().Context(), cc.Param("organizationId"), cc.User().ID, id, data.Role, false); err != nil {
		return err
	}
	return cc.NoContent(204)
}

// removeMemberHandler godoc
// @Summary Revoke organization access and user-owned organization tokens (administrator only)
// @Tags member
// @Param organizationId path string true "Organization ID"
// @Param memberId path int true "Membership ID"
// @Success 204
// @Failure 403 {object} httputil.ErrorResponseData
// @Failure 409 {object} httputil.ErrorResponseData
// @Router /dash/organization/{organizationId}/member/{memberId} [delete]
func (r *handler) removeMemberHandler(c echo.Context) error {
	cc := c.(*appctx.Context)
	id, err := strconv.ParseInt(cc.Param("memberId"), 10, 64)
	if err != nil || id < 1 {
		return echo.NewHTTPError(400, "Invalid member ID")
	}
	if err := r.memberService.ChangeAccess(cc.Request().Context(), cc.Param("organizationId"), cc.User().ID, id, "", true); err != nil {
		return err
	}
	return cc.NoContent(204)
}
