package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/identity/domain"
)

func (r *Repository) CreateLoginChallenge(ctx context.Context, c domain.LoginChallenge) error {
	return r.q.CreateLoginChallenge(ctx, CreateLoginChallengeParams{
		TokenHash: c.TokenHash,
		MemberID:  c.MemberID,
		Challenge: c.Challenge,
		ExpiresAt: c.ExpiresAt,
	})
}

func (r *Repository) LoginChallenge(
	ctx context.Context,
	tokenHash []byte,
	now time.Time,
) (domain.LoginChallenge, error) {
	row, err := r.q.GetLoginChallenge(
		ctx,
		GetLoginChallengeParams{TokenHash: tokenHash, ExpiresAt: now},
	)
	if err != nil {
		return domain.LoginChallenge{}, notFound(err)
	}

	return domain.LoginChallenge{
		TokenHash: row.TokenHash,
		MemberID:  row.MemberID,
		Challenge: row.Challenge,
		ExpiresAt: row.ExpiresAt,
	}, nil
}

func (r *Repository) CountLoginAttempt(
	ctx context.Context,
	tokenHash []byte,
	now time.Time,
	limit int32,
) (int32, bool, error) {
	attempts, err := r.q.CountLoginAttempt(
		ctx,
		CountLoginAttemptParams{TokenHash: tokenHash, Now: now, MaxAttempts: limit},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}

	if err != nil {
		return 0, false, err
	}

	return attempts, true, nil
}

func (r *Repository) DeleteLoginChallenge(ctx context.Context, tokenHash []byte) (bool, error) {
	n, err := r.q.DeleteLoginChallenge(ctx, tokenHash)

	return n > 0, err
}

func (r *Repository) DeleteExpiredLoginChallenges(ctx context.Context, now time.Time) error {
	return r.q.DeleteExpiredLoginChallenges(ctx, now)
}
