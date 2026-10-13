package database

import (
	"time"

	"github.com/uptrace/bun"
)

type User struct {
	bun.BaseModel `bun:"table:user"`
	ID            int64  `bun:"id,pk,autoincrement"`
	Name          string `bun:"name"`
	Username      string `bun:"username"`
	Email         string `bun:"email"`
	PasswordHash  string `bun:"password_hash" json:"-"`
	AuthProvider  string `bun:"auth_provider"`
	AuthID        string `bun:"auth_id"`
	Avatar        string `bun:"avatar"`
	IsAdmin       bool   `bun:"is_admin"`
}

type Session struct {
	bun.BaseModel `bun:"table:session"`
	ID            string    `bun:"id,pk"`
	ExpiresAt     time.Time `bun:"expires_at"`
	UserID        int       `bun:"user_id"`
	User          *User     `bun:"rel:belongs-to,join:user_id=id"`
}

// nanoid to keep the ID more url friendly
// might switch to uuid later
type Organization struct {
	bun.BaseModel `bun:"table:organization"`
	ID            string `bun:"id,pk"`
	Name          string `bun:"name"`
}

type OrganizationMember struct {
	bun.BaseModel  `bun:"table:organization_member"`
	ID             int64         `bun:"id,pk,autoincrement"`
	Role           string        `bun:"role"`
	UserID         int64         `bun:"user_id"`
	OrganizationID string        `bun:"organization_id"`
	User           *User         `bun:"rel:belongs-to,join:user_id=id"`
	Organization   *Organization `bun:"rel:belongs-to,join:organization_id=id"`
}

type Token struct {
	bun.BaseModel  `bun:"table:token"`
	ID             int64         `bun:"id,pk,autoincrement"`
	TokenHash      string        `bun:"token_hash"`
	Identifier     string        `bun:"identifier"`
	UserID         int           `bun:"user_id"`
	User           *User         `bun:"rel:belongs-to,join:user_id=id"`
	OrganizationID string        `bun:"organization_id"`
	Organization   *Organization `bun:"rel:belongs-to,join:organization_id=id"`
	CreatedAt      time.Time     `bun:"created_at,nullzero,notnull,default:current_timestamp"`
}

// nanoid to keep the ID more url friendly
// might switch to uuid later
type Asset struct {
	bun.BaseModel  `bun:"table:asset"`
	ID             string        `bun:"id,pk"`
	Key            string        `bun:"key"`
	Size           int64         `bun:"size"`
	Type           string        `bun:"type"`
	CreatedAt      time.Time     `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt      time.Time     `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
	OrganizationID string        `bun:"organization_id"`
	Organization   *Organization `bun:"rel:belongs-to,join:organization_id=id"`
}

type Dataset struct {
	bun.BaseModel  `bun:"table:dataset"`
	ID             string        `bun:"id,pk"`
	Name           string        `bun:"name"`
	Description    string        `bun:"description"`
	RetentionDays  int           `bun:"retention_days"`
	CreatedAt      time.Time     `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt      time.Time     `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
	OrganizationID string        `bun:"organization_id"`
	Organization   *Organization `bun:"rel:belongs-to,join:organization_id=id"`
}

type Store interface {
	Connect(dsn string) *bun.DB
}

// TODO: Return error if driver is not supported
func New(driver string) Store {
	return &PostgreSQL{}
}
