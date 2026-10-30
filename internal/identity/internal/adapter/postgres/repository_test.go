package postgres

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
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
		t.Fatalf("unexpected member %+v", created)
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

	if got, err := repo.MemberBySession(ctx, s.TokenHash, now); err != nil || got.Member.ID != user.ID || got.BooksID != booksID {
		t.Fatalf("MemberBySession = %+v, %v; want member %d, books %d", got, err, user.ID, booksID)
	}

	if _, err := repo.MemberBySession(ctx, s.TokenHash, s.ExpiresAt); !errors.Is(err, app.ErrNotFound) {
		t.Fatalf("expired session err = %v, want ErrNotFound", err)
	}

	if err := repo.DeleteExpiredSessions(ctx, s.ExpiresAt); err != nil {
		t.Fatal(err)
	}

	if _, err := repo.MemberBySession(ctx, s.TokenHash, now); !errors.Is(err, app.ErrNotFound) {
		t.Fatalf("session survived DeleteExpiredSessions: err = %v", err)
	}

	_, s2 := domain.NewSession(user.ID, booksID, now)
	if err := repo.CreateSession(ctx, s2); err != nil {
		t.Fatal(err)
	}

	if err := repo.DeleteSession(ctx, s2.TokenHash); err != nil {
		t.Fatal(err)
	}

	if _, err := repo.MemberBySession(ctx, s2.TokenHash, now); !errors.Is(err, app.ErrNotFound) {
		t.Fatalf("session survived DeleteSession: err = %v", err)
	}
}

// HA21: two owners demoted at once leave one owner.
func TestChangeRoleConcurrent(t *testing.T) {
	t.Parallel()
	ctx := t.Context()
	pool := pgtest.New(t)
	repo := NewRepository(pool)
	m1, b := pgtest.CreateMember(t, pool)

	var m2 int64

	err := pool.QueryRow(ctx,
		`INSERT INTO identity_member (email, password_hash, role, language) VALUES ('second@example.com', 'x', 'member', 'en') RETURNING id`).Scan(&m2)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := pool.Exec(ctx, `INSERT INTO identity_membership (member_id, books_id, role) VALUES ($1, $2, 'owner')`, m2, b); err != nil {
		t.Fatal(err)
	}

	start := make(chan struct{})
	errs := make([]error, 2)

	var wg sync.WaitGroup

	for i, id := range []int64{m1, m2} {
		wg.Add(1)

		go func() {
			defer wg.Done()

			<-start

			errs[i] = repo.ChangeRole(ctx, b, id, auth.RoleWrite)
		}()
	}

	close(start)
	wg.Wait()

	if !(errs[0] == nil && errors.Is(errs[1], app.ErrLastOwner)) && !(errs[1] == nil && errors.Is(errs[0], app.ErrLastOwner)) {
		t.Fatalf("errors = %v, want nil and ErrLastOwner", errs)
	}

	var owners int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM identity_membership WHERE books_id = $1 AND role = 'owner'`, b).Scan(&owners); err != nil || owners != 1 {
		t.Fatalf("owners = %d, %v; want 1", owners, err)
	}
}
