package postgres

import (
	"errors"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// Spec section 9: an email registered after the invitation makes the acceptance fail and keeps the invitation.
func TestAcceptAsNewMemberEmailTaken(t *testing.T) {
	t.Parallel()
	ctx := t.Context()
	pool := pgtest.New(t)
	repo := NewRepository(pool)
	owner, booksID := pgtest.CreateMember(t, pool)
	now := time.Date(2026, 10, 30, 12, 0, 0, 0, time.UTC)

	token, inv := domain.NewInvitation(booksID, owner, "new@example.com", "write", now)
	if _, err := repo.SaveInvitation(ctx, inv); err != nil {
		t.Fatal(err)
	}

	if _, _, err := repo.CreateMember(ctx, domain.Member{Email: "new@example.com", PasswordHash: "h", Role: domain.RoleMember, Language: "en"}, "US", "USD"); err != nil {
		t.Fatal(err)
	}

	m := domain.Member{Email: "new@example.com", PasswordHash: "h", Role: domain.RoleMember, Language: "en"}
	if _, _, err := repo.AcceptAsNewMember(ctx, domain.HashToken(token), m, now); !errors.Is(err, app.ErrEmailTaken) {
		t.Fatalf("AcceptAsNewMember err = %v, want ErrEmailTaken", err)
	}

	if _, err := repo.InvitationPreview(ctx, domain.HashToken(token), now); err != nil {
		t.Fatalf("invitation after the failed acceptance: %v", err)
	}
}
