package member

import (
	"github.com/fivemanage/lite/internal/service/member"
	"github.com/labstack/echo/v4"
)

type handler struct {
	memberService *member.Service
}

func RegisterRoutes(group *echo.Group, memberService *member.Service) {
	h := handler{
		memberService: memberService,
	}

	group.GET("/organization/:organizationId/member", h.listMembersHandler)
	group.POST("/organization/:organizationId/member", h.addMemberHandler)
	group.PATCH("/organization/:organizationId/member/:memberId", h.updateMemberHandler)
	group.DELETE("/organization/:organizationId/member/:memberId", h.removeMemberHandler)
	group.PATCH("/organization/:organizationId/member/:memberId/password", h.changePasswordHandler)
}
