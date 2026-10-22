package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

const (
	uniqueViolation   = "23505"
	restrictViolation = "23001"
)

// violates reports the error of the named constraint and code.
func violates(err error, code, constraint string) bool {
	pgErr, ok := errors.AsType[*pgconn.PgError](err)
	return ok && pgErr.Code == code && pgErr.ConstraintName == constraint
}

func toIntegration(row IngestionIntegration) domain.Integration {
	return domain.Integration{
		ID: row.ID, UserID: row.UserID, Provider: domain.Provider(row.Aggregator), Name: row.Name,
		SealedCredentials: row.CredentialCiphertext, UpdatedAt: row.UpdatedAt,
	}
}

func (r *Repository) InsertIntegration(ctx context.Context, i domain.Integration) (domain.Integration, error) {
	row, err := r.q.InsertIntegration(ctx, InsertIntegrationParams{
		ID: i.ID, UserID: i.UserID, Aggregator: string(i.Provider), Name: i.Name, CredentialCiphertext: i.SealedCredentials,
	})
	if violates(err, uniqueViolation, "ingestion_integration_name_key") {
		return domain.Integration{}, &domain.FieldError{Field: "name", Message: "is already used by another integration"}
	}
	return toIntegration(row), err
}

func (r *Repository) Integration(ctx context.Context, userID int64, id uuid.UUID) (domain.Integration, error) {
	row, err := r.q.GetIntegration(ctx, GetIntegrationParams{UserID: userID, ID: id})
	return toIntegration(row), notFound(err)
}

func (r *Repository) ListIntegrations(ctx context.Context, userID int64, p page.Request[app.NameKey]) ([]domain.Integration, *app.NameKey, error) {
	limit, name, id := namePage(p)
	rows, err := r.q.ListIntegrations(ctx, ListIntegrationsParams{UserID: userID, RowLimit: limit, AfterName: name, AfterID: id})
	if err != nil {
		return nil, nil, err
	}
	out, next := trimPage(rows, p.Limit, toIntegration, func(row IngestionIntegration) app.NameKey {
		return app.NameKey{Name: row.Name, ID: row.ID}
	})
	return out, next, nil
}

// namePage returns the row limit, with one extra row, and the cursor of a list by name.
func namePage(p page.Request[app.NameKey]) (int32, *string, uuid.NullUUID) {
	limit := int32(p.Limit + 1) //nolint:gosec // limit is at most page.MaxLimit
	if p.After == nil {
		return limit, nil, uuid.NullUUID{}
	}
	return limit, &p.After.Name, uuid.NullUUID{UUID: p.After.ID, Valid: true}
}

func (r *Repository) UpdateCredentials(ctx context.Context, userID int64, id uuid.UUID, sealed []byte) (domain.Integration, error) {
	row, err := r.q.UpdateCredentials(ctx, UpdateCredentialsParams{UserID: userID, ID: id, CredentialCiphertext: sealed})
	return toIntegration(row), notFound(err)
}

func (r *Repository) DeleteIntegration(ctx context.Context, userID int64, id uuid.UUID) error {
	n, err := r.q.DeleteIntegration(ctx, DeleteIntegrationParams{UserID: userID, ID: id})
	switch {
	case violates(err, restrictViolation, "ingestion_connection_integration_fkey"):
		return app.ErrIntegrationInUse
	case err != nil:
		return err
	case n == 0:
		return app.ErrNotFound
	}
	return nil
}

func (r *Repository) ResealCredentials(ctx context.Context, reseal func(userID int64, id uuid.UUID, sealed []byte) ([]byte, error)) (int, error) {
	changed := 0
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		rows, err := q.LockAllCredentials(ctx)
		if err != nil {
			return err
		}
		for _, row := range rows {
			sealed, err := reseal(row.UserID, row.ID, row.CredentialCiphertext)
			if err != nil {
				return err
			}
			if sealed == nil {
				continue
			}
			if err := q.ResealCredentials(ctx, ResealCredentialsParams{UserID: row.UserID, ID: row.ID, CredentialCiphertext: sealed}); err != nil {
				return err
			}
			changed++
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return changed, nil
}
