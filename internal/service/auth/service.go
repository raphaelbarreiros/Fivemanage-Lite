package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/fivemanage/lite/api"
	"github.com/fivemanage/lite/internal/auth"
	"github.com/fivemanage/lite/internal/crypt"
	"github.com/fivemanage/lite/internal/database"
	"github.com/fivemanage/lite/internal/helper/strings"
	"github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
	"golang.org/x/oauth2"
)

type authConfig struct {
	github *oauth2.Config
}

type Service struct {
	config authConfig
	db     *bun.DB
}

func NewService(db *bun.DB) *Service {
	githubConfig := auth.NewGithubConfig()

	return &Service{
		config: authConfig{
			github: githubConfig,
		},
		db: db,
	}
}

// CreateAdminUser creates the initial admin user if none exists

func (r *Service) CreateAdminUser() error {
	var err error
	ctx := context.Background()

	user := new(database.User)
	err = r.db.NewSelect().Model(user).Where("is_admin = ?", true).Limit(1).Scan(ctx)
	if err != nil {
		// todo: create a database.selectError func
		if errors.Is(err, sql.ErrNoRows) {
			logrus.Info("Found no admin user. Attempting to create one.")
		} else {
			return err
		}
	}

	// Provision the bootstrap administrator only when none exists.
	if user.IsAdmin {
		return nil
	}

	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		return errors.New("admin password is missing. make sure ADMIN_PASSWORD is set")
	}

	passwordHash, err := crypt.HashPassword(adminPassword)
	if err != nil {
		return err
	}

	admin := &database.User{
		Name:         "Admin",
		PasswordHash: passwordHash,
		Username:     "admin",
		IsAdmin:      true,
	}
	_, err = r.db.NewInsert().Model(admin).Exec(ctx)
	if err != nil {
		return err
	}

	logrus.Info("Successfully created admin user. Proceeding.")

	return nil
}

// RegisterUser will register the user, no shit, but we need to make sure this is
// only for non-admin users. The actual admin user should have the defalt admin password
// unless changed in ENV, and then be prompted to change it. That should probably be required.

// we will probably remove this, and init everything with an admin user which can create users instead
// .... I guess we can keep it for that thouugh
// doesnt' make much sense to have a register outside anyways
func (r *Service) RegisterUser(ctx context.Context, register *api.RegisterRequest) (string, error) {
	exists := r.userExists(ctx, register.Email)
	if exists {
		return "", errors.New("user already exists")
	}

	userID, err := r.createUser(ctx, register)
	if err != nil {
		return "", err
	}

	sessionID, err := r.createSession(ctx, userID)
	if err != nil {
		return "", err
	}

	// not sure if we really need to return anything else than the error here
	// we can instead create a session as another call and then add that sessionId
	// as a cookie
	return sessionID, nil
}

// Login uses email and password to authenticate the user
func (r *Service) LoginUser(ctx context.Context, username, password string) (string, error) {
	user, err := r.getUserByCredentials(ctx, username, password)
	if err != nil {
		return "", err
	}

	sessionID, err := r.createSession(ctx, user.ID)
	if err != nil {
		return "", err
	}

	// not sure if we really need to return anything else than the error here
	// we can instead create a session as another call and then add that sessionId
	// as a cookie
	return sessionID, nil
}

// OAuthLogin uses OAuth2 to authenticate the user
// This will probably work as register and login, right???
func (r *Service) OAuthLogin() string {
	verifier := oauth2.GenerateVerifier()
	url := r.config.github.AuthCodeURL("state", oauth2.AccessTypeOffline, oauth2.S256ChallengeOption(verifier))

	return url
}

func (r *Service) Callback(code string) *oauth2.Token {
	token, err := r.config.github.Exchange(context.TODO(), code)
	if err != nil {
		fmt.Println(err)
	}

	return token
}

// we probably dont need this function anymore...maybe
func (r *Service) userExists(ctx context.Context, email string) bool {
	user := new(database.User)
	err := r.db.NewSelect().Model(user).Where("email = ?", email).Scan(ctx)
	if err != nil {
		logrus.WithField("email", email).WithError(err).Error("failed to check if user exists")
	}

	if user.ID == 0 {
		return false
	}

	return user.ID != 0
}

// CreateUser creates a new user with email and password
func (r *Service) createUser(ctx context.Context, register *api.RegisterRequest) (int64, error) {
	var err error
	hash, err := crypt.HashPassword(register.Password)
	if err != nil {
		logrus.WithError(err).Error("failed to hash password")
		return 0, err
	}

	user := &database.User{
		Email:        register.Email,
		PasswordHash: hash,
	}

	// this should be a tx, so we can rollback if we fail to get the LID
	res, err := r.db.NewInsert().Model(user).Exec(ctx)
	if err != nil {
		return 0, err
	}

	// this should be the userID
	lid, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}

	return lid, nil
}

func (r *Service) getUserByCredentials(ctx context.Context, username, password string) (*database.User, error) {
	var err error

	user := new(database.User)
	err = r.db.NewSelect().Model(user).Where("username = ?", username).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &ErrUserCredentials{}
		} else {
			return nil, err
		}
	}

	err = crypt.ComparePassword(user.PasswordHash, password)
	if err != nil {
		return nil, &ErrUserCredentials{}
	}

	return user, nil
}

// not sure if this should be public or not yet
func (r *Service) createSession(ctx context.Context, userID int64) (string, error) {
	sessionID, err := crypt.GenerateSessionID()
	if err != nil {
		return "", err
	}

	session := &database.Session{
		ID:        sessionID,
		UserID:    int(userID),
		ExpiresAt: time.Now().Add(auth.SessionDuration),
	}

	_, err = r.db.NewInsert().Model(session).Exec(ctx)
	if err != nil {
		return "", err
	}

	return session.ID, nil
}

func (r *Service) UserBySession(ctx context.Context, sessionID string) (*api.User, error) {
	session := new(database.Session)
	err := r.db.NewSelect().Model(session).Relation("User").Where("session.id = ?", sessionID).Limit(1).Scan(ctx)
	if err != nil {
		return nil, err
	}

	if time.Now().After(session.ExpiresAt) {
		return nil, ErrSessionExpired{}
	}

	return &api.User{
		ID:       session.User.ID,
		Username: session.User.Username,
		IsAdmin:  session.User.IsAdmin,
		Name:     strings.Null(session.User.Name),
		Email:    strings.Null(session.User.Email),
		Avatar:   strings.Null(session.User.Avatar),
	}, nil
}

func (r *Service) IsOrganizationMember(ctx context.Context, userID int64, organizationID string) (bool, error) {
	member := new(database.OrganizationMember)
	err := r.db.NewSelect().Model(member).
		Where("user_id = ? AND organization_id = ?", userID, organizationID).
		Limit(1).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

func (r *Service) LogoutUser(ctx context.Context, sessionID string) error {
	_, err := r.db.NewDelete().Model((*database.Session)(nil)).Where("id = ?", sessionID).Exec(ctx)
	return err
}

func (r *Service) CreateSessionCookie(sessionID string) *http.Cookie {
	isProduction := os.Getenv("ENV") == "production"
	return &http.Cookie{
		Name:     auth.SessionCookieName,
		Value:    sessionID,
		Secure:   isProduction,
		SameSite: http.SameSiteLaxMode,
		HttpOnly: true,
		Path:     "/",
		Expires:  time.Now().Add(auth.SessionDuration),
	}
}

func (r *Service) CreateLogoutCookie() *http.Cookie {
	return &http.Cookie{
		Name:     auth.SessionCookieName,
		Value:    "",
		HttpOnly: true,
		Path:     "/",
		Expires:  time.Now().Add(-time.Hour),
		MaxAge:   -1,
	}
}
