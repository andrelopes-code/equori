package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (r *Repository) CreateSession(ctx context.Context, s domain.Session) error {
	return r.q.CreateSession(ctx, CreateSessionParams{
		TokenHash: s.TokenHash,
		MemberID:  s.MemberID,
		BooksID:   s.BooksID,
		CreatedAt: s.CreatedAt,
		ExpiresAt: s.ExpiresAt,
	})
}

func (r *Repository) SwitchSession(ctx context.Context, tokenHash []byte, memberID, booksID int64, at time.Time) error {
	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		n, err := q.TouchMembership(ctx, TouchMembershipParams{MemberID: memberID, BooksID: booksID, LastActiveAt: at})
		if err != nil {
			return err
		}

		if n == 0 {
			return app.ErrBooksNotFound
		}

		n, err = q.SwitchSession(ctx, SwitchSessionParams{TokenHash: tokenHash, MemberID: memberID, BooksID: booksID})
		if err != nil {
			return err
		}

		if n == 0 {
			return app.ErrUnauthenticated
		}

		return nil
	})
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == foreignKeyViolation {
		return app.ErrBooksNotFound
	}

	return err
}

func (r *Repository) MemberBySession(ctx context.Context, tokenHash []byte, now time.Time) (app.Access, error) {
	row, err := r.q.GetMemberBySession(ctx, GetMemberBySessionParams{TokenHash: tokenHash, ExpiresAt: now})
	if err != nil {
		return app.Access{}, notFound(err)
	}

	user := toMember(IdentityMember{
		ID: row.ID, Email: row.Email, PasswordHash: row.PasswordHash, Role: row.Role,
		DisabledAt: row.DisabledAt, CreatedAt: row.CreatedAt, Language: row.Language, DisplayName: row.DisplayName,
	})

	return app.Access{Member: user, BooksID: row.BooksID, Role: auth.BookRole(row.BookRole)}, nil
}

func (r *Repository) DeleteSession(ctx context.Context, tokenHash []byte) error {
	return r.q.DeleteSession(ctx, tokenHash)
}

func (r *Repository) DeleteExpiredSessions(ctx context.Context, now time.Time) error {
	return r.q.DeleteExpiredSessions(ctx, now)
}
