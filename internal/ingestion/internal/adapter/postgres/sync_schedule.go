package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (r *Repository) SyncInterval(ctx context.Context) (int, bool, error) {
	minutes, err := r.q.GetSyncInterval(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}

	if err != nil {
		return 0, false, err
	}

	return int(minutes), true, nil
}

func (r *Repository) SetSyncInterval(ctx context.Context, minutes int) error {
	return r.q.SetSyncInterval(ctx, int32(minutes)) //nolint:gosec // the contract bounds minutes to 1..1440
}
