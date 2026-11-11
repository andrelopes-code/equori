package identity

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// Authorize must wrap the whole HTTP handler: it is the single authorization point for /api/ (HA9).
// required returns the x-book-role of the operation r matches, and whether r matches one.
func (m *Module) Authorize(next http.Handler, required func(*http.Request) (role string, matched bool)) http.Handler {
	return m.http.Authorize(next, required)
}

// VerifyAccessToken returns the grant of a valid personal access token, or ErrInvalidAccessToken.
func (m *Module) VerifyAccessToken(ctx context.Context, token string) (AccessGrant, error) {
	t, err := m.svc.VerifyAccessToken(ctx, token)
	if err != nil {
		return AccessGrant{}, err
	}

	return AccessGrant{TokenID: t.ID, MemberID: t.MemberID, BooksID: t.BooksID, Scope: t.Scope, Role: auth.BookRole(t.Role)}, nil
}
