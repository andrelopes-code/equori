package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/identity/app"
)

func (r *Repository) ReplaceRecoveryCodes(
	ctx context.Context,
	memberID int64,
	hashes [][]byte,
	at time.Time,
) error {
	return r.withMemberLock(ctx, memberID, func(q *Queries) error {
		has, err := q.HasSecondFactor(ctx, memberID)
		if err != nil {
			return err
		}

		if !has {
			return app.ErrSecondFactorMissing
		}

		return storeRecoveryCodes(ctx, q, memberID, hashes, at)
	})
}

func (r *Repository) UseRecoveryCode(
	ctx context.Context,
	memberID int64,
	hash []byte,
) (int, bool, error) {
	var left int

	used := false

	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		n, err := q.UseRecoveryCode(ctx, UseRecoveryCodeParams{MemberID: memberID, CodeHash: hash})
		if err != nil {
			return err
		}

		count, err := q.CountRecoveryCodes(ctx, memberID)
		if err != nil {
			return err
		}

		used, left = n > 0, int(count)

		return nil
	})
	if err != nil {
		return 0, false, err
	}

	return left, used, nil
}

// applyFirstFactor stores the recovery codes and ends the other sessions of a member whose first factor this is.
func applyFirstFactor(
	ctx context.Context,
	q *Queries,
	memberID int64,
	first bool,
	f app.FirstFactor,
) error {
	if !first {
		return nil
	}

	if err := storeRecoveryCodes(ctx, q, memberID, f.Hashes, f.At); err != nil {
		return err
	}

	return q.DeleteOtherSessions(
		ctx,
		DeleteOtherSessionsParams{MemberID: memberID, TokenHash: f.KeepSession},
	)
}

func storeRecoveryCodes(
	ctx context.Context,
	q *Queries,
	memberID int64,
	hashes [][]byte,
	at time.Time,
) error {
	if err := q.DeleteRecoveryCodes(ctx, memberID); err != nil {
		return err
	}

	for _, hash := range hashes {
		if err := q.InsertRecoveryCode(
			ctx,
			InsertRecoveryCodeParams{MemberID: memberID, CodeHash: hash, CreatedAt: at},
		); err != nil {
			return err
		}
	}

	return nil
}

// dropCodesWithoutFactor deletes the recovery codes when the member has no factor left.
func dropCodesWithoutFactor(ctx context.Context, q *Queries, memberID int64) error {
	has, err := q.HasSecondFactor(ctx, memberID)
	if err != nil {
		return err
	}

	if has {
		return nil
	}

	return q.DeleteRecoveryCodes(ctx, memberID)
}
