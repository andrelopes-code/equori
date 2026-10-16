package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

const foreignKeyViolation = "23503"

// notFound maps a missing row, and a reference to an account the user does not own, to app.ErrNotFound.
func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return app.ErrNotFound
	}
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == foreignKeyViolation {
		return app.ErrNotFound
	}
	return err
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func value(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func toProfile(row IngestionCsvProfile) domain.Profile {
	return domain.Profile{
		UserID: row.UserID, AccountID: row.AccountID, Delimiter: row.Delimiter, HeaderRows: int(row.HeaderRows),
		DateColumn: row.DateColumn, DateLayout: domain.DateLayout(row.DateLayout), AmountColumn: value(row.AmountColumn),
		DebitColumn: value(row.DebitColumn), CreditColumn: value(row.CreditColumn), DecimalSeparator: row.DecimalSeparator,
		DescriptionColumn: row.DescriptionColumn, IDColumn: value(row.IDColumn), AmountSign: domain.AmountSign(row.AmountSign),
	}
}

func (r *Repository) Profile(ctx context.Context, userID int64, accountID uuid.UUID) (domain.Profile, error) {
	row, err := r.q.GetProfile(ctx, GetProfileParams{UserID: userID, AccountID: accountID})
	if err != nil {
		return domain.Profile{}, notFound(err)
	}
	return toProfile(row), nil
}

func (r *Repository) SaveProfile(ctx context.Context, p domain.Profile) (domain.Profile, error) {
	row, err := r.q.UpsertProfile(ctx, UpsertProfileParams{
		UserID: p.UserID, AccountID: p.AccountID, Delimiter: p.Delimiter, HeaderRows: int32(p.HeaderRows), //nolint:gosec // at most 10
		DateColumn: p.DateColumn, DateLayout: string(p.DateLayout), AmountColumn: optional(p.AmountColumn),
		DebitColumn: optional(p.DebitColumn), CreditColumn: optional(p.CreditColumn), DecimalSeparator: p.DecimalSeparator,
		DescriptionColumn: p.DescriptionColumn, IDColumn: optional(p.IDColumn), AmountSign: string(p.AmountSign),
	})
	if err != nil {
		return domain.Profile{}, notFound(err)
	}
	return toProfile(row), nil
}
