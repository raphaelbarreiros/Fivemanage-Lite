package api

type OrganizationMember struct {
	ID       int64  `json:"id"`
	UserID   int64  `json:"userId"`
	Role     string `json:"role"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	IsAdmin  bool   `json:"isAdmin"`
}

type AddOrganizationMemberRequest struct {
	Username string `json:"username" validate:"required,max=64"`
	Role     string `json:"role" validate:"required,oneof=ADMIN MEMBER"`
	Create   bool   `json:"create"`
	Name     string `json:"name" validate:"max=100"`
	Email    string `json:"email" validate:"omitempty,email,max=254"`
	Password string `json:"password"`
}

type UpdateOrganizationMemberRequest struct {
	Role string `json:"role" validate:"required,oneof=ADMIN MEMBER"`
}

type ChangeMemberPasswordRequest struct {
	Password string `json:"password" validate:"required"`
}
