// Package postgres stores the settings of the instance.
package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/instance/internal/app"
	"github.com/andrelopes-code/equori/internal/instance/internal/domain"
)

var _ app.Repository = (*Repository)(nil)

type Repository struct{ q *Queries }

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{q: New(pool)} }

// Settings returns the defaults while no row exists.
func (r *Repository) Settings(ctx context.Context) (domain.Settings, error) {
	row, err := r.q.GetSettings(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Settings{CopyState: domain.CopyPasswordUnset}, nil
	}

	if err != nil {
		return domain.Settings{}, err
	}

	s := domain.Settings{
		UpdateCheck: row.UpdateCheck, CopyPassword: row.CopyPassword, CopyState: domain.CopyState(row.CopyState),
		CopyAttemptAt: row.CopyAttemptAt, CopyAt: row.CopyAt,
	}
	if row.CopyFile != nil {
		s.CopyFile = *row.CopyFile
	}

	return s, nil
}

func (r *Repository) SetCopyPassword(ctx context.Context, sealed []byte) error {
	return r.q.SetCopyPassword(ctx, sealed)
}

func (r *Repository) SaveCopyAttempt(ctx context.Context, state domain.CopyState, attemptAt time.Time, copyAt *time.Time, copyFile *string) error {
	return r.q.SaveCopyAttempt(ctx, SaveCopyAttemptParams{
		CopyState:     string(state),
		CopyAttemptAt: &attemptAt,
		CopyAt:        copyAt,
		CopyFile:      copyFile,
	})
}

func (r *Repository) SetUpdateCheck(ctx context.Context, consent bool) error {
	return r.q.SetUpdateCheck(ctx, &consent)
}
