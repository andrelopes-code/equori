// Package postgres stores the providers and chains of the assistant module.
package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

const uniqueViolation = "23505"

type Repository struct {
	pool *pgxpool.Pool
	q    *Queries
}

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool, q: New(pool)} }

func toProvider(row AssistantProvider) domain.Provider {
	return domain.Provider{
		ID: row.ID, UserID: row.UserID, Preset: row.Preset, Name: row.Name, BaseURL: row.BaseUrl,
		SealedKey: row.SealedKey, CreatedAt: row.CreatedAt,
	}
}

func nameTaken(err error) error {
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation &&
		pgErr.ConstraintName == "assistant_provider_name_key" {
		return &domain.FieldError{Field: "name", Message: "is already used by another provider"}
	}
	return err
}

func (r *Repository) InsertProvider(ctx context.Context, p domain.Provider) error {
	return nameTaken(r.q.InsertProvider(ctx, InsertProviderParams{
		ID: p.ID, UserID: p.UserID, Preset: p.Preset, Name: p.Name, BaseUrl: p.BaseURL, SealedKey: p.SealedKey, CreatedAt: p.CreatedAt,
	}))
}

func (r *Repository) Provider(ctx context.Context, userID int64, id uuid.UUID) (domain.Provider, error) {
	row, err := r.q.GetProvider(ctx, GetProviderParams{UserID: userID, ID: id})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Provider{}, domain.ErrProviderNotFound
	}
	return toProvider(row), err
}

func (r *Repository) Providers(ctx context.Context, userID int64) ([]domain.Provider, error) {
	rows, err := r.q.ListProviders(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Provider, len(rows))
	for i, row := range rows {
		out[i] = toProvider(row)
	}
	return out, nil
}

func (r *Repository) UpdateProvider(ctx context.Context, p domain.Provider) error {
	n, err := r.q.UpdateProvider(ctx, UpdateProviderParams{UserID: p.UserID, ID: p.ID, Name: p.Name, BaseUrl: p.BaseURL, SealedKey: p.SealedKey})
	if err != nil {
		return nameTaken(err)
	}
	if n == 0 {
		return domain.ErrProviderNotFound
	}
	return nil
}

// DeleteProvider also deletes the chain targets on the provider (ON DELETE CASCADE), and its
// usage and limits, whose text provider ID has no foreign key (ADR 019 U5).
func (r *Repository) DeleteProvider(ctx context.Context, userID int64, id uuid.UUID) error {
	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		n, err := q.DeleteProvider(ctx, DeleteProviderParams{UserID: userID, ID: id})
		if err != nil {
			return err
		}
		if n == 0 {
			return domain.ErrProviderNotFound
		}
		if err := q.DeleteProviderUsage(ctx, DeleteProviderUsageParams{UserID: userID, ProviderID: id.String()}); err != nil {
			return err
		}
		return q.DeleteProviderLimits(ctx, DeleteProviderLimitsParams{UserID: userID, ProviderID: id.String()})
	})
}

// Chains returns the user's chain targets by use ID, in position order.
func (r *Repository) Chains(ctx context.Context, userID int64) (map[string][]domain.ChainTarget, error) {
	rows, err := r.q.ListChainTargets(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := map[string][]domain.ChainTarget{}
	for _, row := range rows {
		out[row.UseID] = append(out[row.UseID], domain.ChainTarget{ProviderID: row.ProviderID, Model: row.Model, Capabilities: row.Capabilities})
	}
	return out, nil
}

// ReplaceChain stores targets as the user's chain for useID; an empty list deletes it. A
// target on a provider the user does not own returns ErrProviderNotFound.
func (r *Repository) ReplaceChain(ctx context.Context, userID int64, useID string, targets []domain.ChainTarget) error {
	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		if err := q.DeleteChain(ctx, DeleteChainParams{UserID: userID, UseID: useID}); err != nil {
			return err
		}
		for i, t := range targets {
			err := q.InsertChainTarget(ctx, InsertChainTargetParams{
				UserID: userID, UseID: useID, Position: int32(i), //nolint:gosec // a chain has few targets
				ProviderID: t.ProviderID, Model: t.Model, Capabilities: t.Capabilities,
			})
			if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == "23503" {
				return domain.ErrProviderNotFound
			}
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *Repository) ResealKeys(ctx context.Context, reseal func(userID int64, id uuid.UUID, sealed []byte) ([]byte, error)) (int, error) {
	changed := 0
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		rows, err := q.LockAllKeys(ctx)
		if err != nil {
			return err
		}
		for _, row := range rows {
			sealed, err := reseal(row.UserID, row.ID, row.SealedKey)
			if err != nil {
				return err
			}
			if sealed == nil {
				continue
			}
			if err := q.ResealKey(ctx, ResealKeyParams{UserID: row.UserID, ID: row.ID, SealedKey: sealed}); err != nil {
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
