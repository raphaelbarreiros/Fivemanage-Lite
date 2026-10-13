package organization

import (
	"github.com/fivemanage/lite/internal/service/organization"
	"github.com/labstack/echo/v4"
)

type handler struct {
	organizationService *organization.Service
}

func RegisterRoutes(group *echo.Group, organizationService *organization.Service) {
	h := handler{
		organizationService: organizationService,
	}

	group.POST("/organization", h.createOrganizationHandler)
	group.GET("/organization", h.listOrganizationsHandler)
	group.GET("/organization/:organizationId", h.getOrganizationHandler)
	group.GET("/organization/:organizationId/stats", h.getOrganizationStatsHandler)
	group.PATCH("/organization/:organizationId", h.renameOrganizationHandler)
	group.DELETE("/organization/:organizationId", h.deleteOrganizationHandler)
}
