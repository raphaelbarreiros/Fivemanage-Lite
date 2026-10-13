package auth

import (
	"errors"
	"net/http"

	"github.com/fivemanage/lite/api"
	"github.com/fivemanage/lite/internal/http/appctx"
	"github.com/fivemanage/lite/internal/http/httputil"
	"github.com/fivemanage/lite/internal/http/validator"
	"github.com/fivemanage/lite/internal/service/auth"
	"github.com/labstack/echo/v4"

	internalauth "github.com/fivemanage/lite/internal/auth"
)

// getSessionHandler godoc
// @Summary      Get current session
// @Description  Get the current user session from the session cookie
// @Tags         auth
// @Produce      json
// @Success      200  {object}  httputil.ResponseData{data=api.User}
// @Failure      401  {object}  httputil.ErrorResponseData
// @Router       /dash/auth/session [get]
func (r *handler) getSessionHandler(c echo.Context) error {
	cc := c.(*appctx.Context)
	ctx := cc.Request().Context()

	sessionCookie, err := cc.Cookie(internalauth.SessionCookieName)
	if err != nil {
		return cc.JSON(http.StatusUnauthorized, httputil.ErrorResponse("Already logged out"))
	}

	user, err := r.authService.UserBySession(ctx, sessionCookie.Value)
	if err != nil {
		return cc.JSON(http.StatusUnauthorized, httputil.ErrorResponse("Invalid session"))
	}

	return cc.JSON(http.StatusOK, httputil.Response(user))
}

// loginHandler godoc
// @Summary      Login
// @Description  Login with username and password
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        login  body      api.LoginRequest  true  "Login Request"
// @Success      200    {object}  httputil.ResponseData{data=string}
// @Failure      400    {object}  httputil.ErrorResponseData
// @Failure      403    {object}  httputil.ErrorResponseData
// @Router       /dash/auth/login [post]
func (r *handler) loginHandler(c echo.Context) error {
	cc := c.(*appctx.Context)
	ctx := cc.Request().Context()

	var login api.LoginRequest
	if err := validator.BindAndValidate(cc, &login); err != nil {
		return cc.JSON(http.StatusBadRequest, httputil.ErrorResponse(err.Error()))
	}

	sessionID, err := r.authService.LoginUser(ctx, login.Username, login.Password)
	if err != nil {
		// this might not be the way we want to handle these errors
		// might be better to send some sort of code instead that we can map on the client?
		// as this could get veryyy long some places
		// errors.As() is also an option
		if errors.Is(err, auth.ErrUserCredentials{}) {
			return c.JSON(http.StatusForbidden, httputil.ErrorResponse("The username or password is wrong. Please try again"))
		}
		// this also bad
		return c.JSON(http.StatusForbidden, httputil.ErrorResponse(err.Error()))

	}

	sessionCookie := r.authService.CreateSessionCookie(sessionID)
	c.SetCookie(sessionCookie)
	return cc.JSON(http.StatusOK, httputil.Response("Login successful"))
}

// logoutHandler godoc
// @Summary      Logout
// @Description  Logout current user and clear session cookie
// @Tags         auth
// @Produce      json
// @Success      200  {object}  httputil.ResponseData{data=string}
// @Failure      500  {object}  httputil.ErrorResponseData
// @Router       /dash/auth/logout [post]
func (r *handler) logoutHandler(c echo.Context) error {
	cc := c.(*appctx.Context)
	ctx := cc.Request().Context()

	sessionCookie, err := cc.Cookie(internalauth.SessionCookieName)
	if err != nil {
		// better error handling here
		return cc.JSON(http.StatusOK, httputil.Response("Already logged out"))
	}

	err = r.authService.LogoutUser(ctx, sessionCookie.Value)
	if err != nil {
		// here too
		return cc.JSON(http.StatusInternalServerError, httputil.ErrorResponse("Failed to logout"))
	}

	logoutCookie := r.authService.CreateLogoutCookie()
	cc.SetCookie(logoutCookie)

	// change this dumb ahhh response
	return cc.JSON(http.StatusOK, httputil.Response("Logout successful"))
}
