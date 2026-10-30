package postgres

import (
	"errors"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func TestRepositoryUsers(t *testing.T) {
	t.Parallel()
	ctx := t.Context()
	repo := NewRepository(pgtest.New(t))
	in := domain.Member{Email: "ann@example.com", PasswordHash: "h", Role: domain.RoleAdmin, Language: "pt"}

	created, _, err := repo.CreateMember(ctx, in, "BR", "BRL")
	if err != nil {
		t.Fatal(err)
	}

	if created.ID == 0 || created.Email != in.Email || created.Role != in.Role || created.Disabled {
		t.Fatalf("unexpected user %+v", created)
	}

	if _, _, err := repo.CreateMember(ctx, in, "BR", "BRL"); !errors.Is(err, app.ErrEmailTaken) {
		t.Fatalf("duplicate email err = %v, want ErrEmailTaken", err)
	}

	got, err := repo.MemberByEmail(ctx, in.Email)
	if err != nil || got != created {
		t.Fatalf("MemberByEmail = %+v, %v; want %+v", got, err, created)
	}

	if _, err := repo.MemberByEmail(ctx, "nobody@example.com"); !errors.Is(err, app.ErrNotFound) {
		t.Fatalf("unknown email err = %v, want ErrNotFound", err)
	}
}

func TestRepositorySessions(t *testing.T) {
	t.Parallel()
	ctx := t.Context()
	repo := NewRepository(pgtest.New(t))

	user, booksID, err := repo.CreateMember(ctx, domain.Member{Email: "ann@example.com", PasswordHash: "h", Role: domain.RoleMember, Language: "pt"}, "BR", "BRL")
	if err != nil {
		t.Fatal(err)
	}

	now := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)

	_, s := domain.NewSession(user.ID, booksID, now)
	if err := repo.CreateSession(ctx, s); err != nil {
		t.Fatal(err)
	}

	if got, gotBooks, err := repo.MemberBySession(ctx, s.TokenHash, now); err != nil || got.ID != user.ID || gotBooks != booksID {
		t.Fatalf("MemberBySession = %+v, %d, %v; want user %d, books %d", got, gotBooks, err, user.ID, booksID)
	}

	if _, _, err := repo.MemberBySession(ctx, s.TokenHash, s.ExpiresAt); !errors.Is(err, app.ErrNotFound) {
		t.Fatalf("expired session err = %v, want ErrNotFound", err)
	}

	if err := repo.DeleteExpiredSessions(ctx, s.ExpiresAt); err != nil {
		t.Fatal(err)
	}

	if _, _, err := repo.MemberBySession(ctx, s.TokenHash, now); !errors.Is(err, app.ErrNotFound) {
		t.Fatalf("session survived DeleteExpiredSessions: err = %v", err)
	}

	_, s2 := domain.NewSession(user.ID, booksID, now)
	if err := repo.CreateSession(ctx, s2); err != nil {
		t.Fatal(err)
	}

	if err := repo.DeleteSession(ctx, s2.TokenHash); err != nil {
		t.Fatal(err)
	}

	if _, _, err := repo.MemberBySession(ctx, s2.TokenHash, now); !errors.Is(err, app.ErrNotFound) {
		t.Fatalf("session survived DeleteSession: err = %v", err)
	}
}
