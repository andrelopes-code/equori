package identity

import (
	"context"

	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// RotateSecrets reseals every TOTP secret under the current key (ADR 008).
func (m *Module) RotateSecrets(ctx context.Context) (int, error) { return m.svc.RotateSecrets(ctx) }

// IsAdmin reports whether a member has the role admin.
func (m *Module) IsAdmin(ctx context.Context, memberID int64) (bool, error) {
	return m.svc.IsAdmin(ctx, memberID)
}

func (m *Module) CreateMember(ctx context.Context, email, password, role string, l locale.Locale, baseCurrency money.Currency) (Member, error) {
	u, err := m.svc.CreateMember(ctx, email, password, domain.Role(role), l, baseCurrency)
	if err != nil {
		return Member{}, err
	}

	return Member{ID: u.ID, Email: u.Email, Role: string(u.Role)}, nil
}

// ResetSecondFactor deletes the second factor, pending logins and sessions of the member with email (HA49).
func (m *Module) ResetSecondFactor(ctx context.Context, email string) (memberID int64, err error) {
	return m.svc.ResetSecondFactor(ctx, email)
}
