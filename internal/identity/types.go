package identity

import (
	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

const (
	RoleAdmin  = string(domain.RoleAdmin)
	RoleMember = string(domain.RoleMember)
)

var (
	ErrEmailTaken = app.ErrEmailTaken
	// ErrUnknownEmail is returned by ResetSecondFactor when no member has the email.
	ErrUnknownEmail = app.ErrNotFound
	// ErrInvalidAccessToken is a malformed, unknown, expired or deleted access token.
	ErrInvalidAccessToken = app.ErrInvalidAccessToken
)

// AccessGrant is what a valid personal access token allows: one member's tools in one book under a scope (design 2026-10-26 X12).
type AccessGrant struct {
	TokenID  uuid.UUID
	MemberID int64
	BooksID  int64
	Scope    string
	// Role is the member's role in the book at this verification (HA16).
	Role auth.BookRole
}

type Member struct {
	ID    int64
	Email string
	Role  string
}
