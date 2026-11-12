package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/identity/domain"
)

func (r *Repository) SecondFactor(ctx context.Context, memberID int64) (app.SecondFactor, error) {
	summary, err := r.q.GetSecondFactorSummary(ctx, memberID)
	if err != nil {
		return app.SecondFactor{}, fmt.Errorf("get second factor summary: %w", err)
	}

	rows, err := r.q.ListPasskeys(ctx, memberID)
	if err != nil {
		return app.SecondFactor{}, fmt.Errorf("list passkeys: %w", err)
	}

	passkeys := make([]domain.Passkey, 0, len(rows))
	for _, row := range rows {
		passkeys = append(passkeys, toPasskey(row))
	}

	return app.SecondFactor{
		TOTP:              summary.Totp,
		Passkeys:          passkeys,
		RecoveryCodesLeft: int(summary.RecoveryCodesLeft),
	}, nil
}

func (r *Repository) HasSecondFactor(ctx context.Context, memberID int64) (bool, error) {
	return r.q.HasSecondFactor(ctx, memberID)
}

func (r *Repository) SaveTOTP(
	ctx context.Context,
	memberID int64,
	sealed []byte,
	at time.Time,
) error {
	n, err := r.q.UpsertTOTP(
		ctx,
		UpsertTOTPParams{MemberID: memberID, SealedSecret: sealed, CreatedAt: at},
	)
	if err != nil {
		return fmt.Errorf("save totp: %w", err)
	}

	if n == 0 {
		return app.ErrTOTPEnabled
	}

	return nil
}

func (r *Repository) TOTP(ctx context.Context, memberID int64) (domain.TOTP, error) {
	row, err := r.q.GetTOTP(ctx, memberID)
	if err != nil {
		return domain.TOTP{}, notFound(err)
	}

	return domain.TOTP{
		MemberID:  row.MemberID,
		Sealed:    row.SealedSecret,
		Confirmed: row.ConfirmedAt != nil,
		LastStep:  row.LastStep,
	}, nil
}

func (r *Repository) ConfirmTOTP(
	ctx context.Context,
	memberID, step int64,
	f app.FirstFactor,
) (bool, error) {
	var first bool

	err := r.withMemberLock(ctx, memberID, func(q *Queries) error {
		had, err := q.HasSecondFactor(ctx, memberID)
		if err != nil {
			return err
		}

		n, err := q.ConfirmTOTP(
			ctx,
			ConfirmTOTPParams{ConfirmedAt: &f.At, Step: step, MemberID: memberID},
		)
		if err != nil {
			return err
		}

		if n == 0 {
			return app.ErrTOTPCodeInvalid
		}

		first = !had

		return applyFirstFactor(ctx, q, memberID, first, f)
	})

	return first, err
}

func (r *Repository) AddPasskey(
	ctx context.Context,
	p domain.Passkey,
	f app.FirstFactor,
) (bool, error) {
	var first bool

	err := r.withMemberLock(ctx, p.MemberID, func(q *Queries) error {
		had, err := q.HasSecondFactor(ctx, p.MemberID)
		if err != nil {
			return err
		}

		err = q.InsertPasskey(ctx, InsertPasskeyParams{
			ID:           p.ID,
			MemberID:     p.MemberID,
			CredentialID: p.CredentialID,
			PublicKey:    p.PublicKey,
			//nolint:gosec // G115: the column admits -7, -8 and -257.
			Algorithm: int32(p.Algorithm),
			SignCount: int64(p.SignCount),
			RpID:      p.RPID,
			Name:      p.Name,
			CreatedAt: p.CreatedAt,
		})
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
			return app.ErrPasskeyInvalid
		}

		if err != nil {
			return err
		}

		first = !had

		return applyFirstFactor(ctx, q, p.MemberID, first, f)
	})

	return first, err
}

func (r *Repository) DisableTOTP(ctx context.Context, memberID int64) error {
	return r.withMemberLock(ctx, memberID, func(q *Queries) error {
		if err := q.DeleteTOTP(ctx, memberID); err != nil {
			return err
		}

		return dropCodesWithoutFactor(ctx, q, memberID)
	})
}

func (r *Repository) RemovePasskey(ctx context.Context, memberID int64, id uuid.UUID) error {
	return r.withMemberLock(ctx, memberID, func(q *Queries) error {
		n, err := q.DeletePasskey(ctx, DeletePasskeyParams{MemberID: memberID, ID: id})
		if err != nil {
			return err
		}

		if n == 0 {
			return app.ErrPasskeyNotFound
		}

		return dropCodesWithoutFactor(ctx, q, memberID)
	})
}

func (r *Repository) SavePasskeyChallenge(
	ctx context.Context,
	memberID int64,
	challenge []byte,
	expiresAt time.Time,
) error {
	return r.q.UpsertPasskeyChallenge(
		ctx,
		UpsertPasskeyChallengeParams{
			MemberID:  memberID,
			Challenge: challenge,
			ExpiresAt: expiresAt,
		},
	)
}

func (r *Repository) TakePasskeyChallenge(
	ctx context.Context,
	memberID int64,
	now time.Time,
) ([]byte, error) {
	row, err := r.q.TakePasskeyChallenge(ctx, memberID)
	if err != nil {
		return nil, notFound(err)
	}

	if !row.ExpiresAt.After(now) {
		return nil, app.ErrNotFound
	}

	return row.Challenge, nil
}

func (r *Repository) UseTOTPStep(ctx context.Context, memberID, step int64) (bool, error) {
	n, err := r.q.UseTOTPStep(ctx, UseTOTPStepParams{Step: step, MemberID: memberID})

	return n > 0, err
}

func (r *Repository) UsePasskey(
	ctx context.Context,
	memberID int64,
	id uuid.UUID,
	signCount uint32,
	at time.Time,
) (bool, error) {
	n, err := r.q.UsePasskey(
		ctx,
		UsePasskeyParams{SignCount: int64(signCount), UsedAt: &at, MemberID: memberID, ID: id},
	)

	return n > 0, err
}

func (r *Repository) ResetSecondFactor(ctx context.Context, memberID int64) error {
	return r.withMemberLock(ctx, memberID, func(q *Queries) error {
		for _, del := range []func(context.Context, int64) error{
			q.DeleteTOTP,
			q.DeletePasskeys,
			q.DeleteRecoveryCodes,
			q.DeletePasskeyChallenge,
			q.DeleteMemberLoginChallenges,
			q.DeleteMemberSessions,
		} {
			if err := del(ctx, memberID); err != nil {
				return err
			}
		}

		return nil
	})
}

func (r *Repository) ResealTOTP(
	ctx context.Context,
	reseal func(memberID int64, sealed []byte) ([]byte, error),
) (int, error) {
	changed := 0

	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		rows, err := q.ListSealedTOTP(ctx)
		if err != nil {
			return err
		}

		for _, row := range rows {
			sealed, err := reseal(row.MemberID, row.SealedSecret)
			if err != nil {
				return err
			}

			if sealed == nil {
				continue
			}

			if err := q.UpdateSealedTOTP(
				ctx,
				UpdateSealedTOTPParams{MemberID: row.MemberID, SealedSecret: sealed},
			); err != nil {
				return err
			}

			changed++
		}

		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("reseal totp secrets: %w", err)
	}

	return changed, nil
}

// withMemberLock runs apply in a transaction under the lock of the member row (HA37).
func (r *Repository) withMemberLock(
	ctx context.Context,
	memberID int64,
	apply func(*Queries) error,
) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		if _, err := q.LockMember(ctx, memberID); err != nil {
			return notFound(err)
		}

		return apply(q)
	})
}

func toPasskey(row IdentityPasskey) domain.Passkey {
	return domain.Passkey{
		ID:           row.ID,
		MemberID:     row.MemberID,
		CredentialID: row.CredentialID,
		PublicKey:    row.PublicKey,
		Algorithm:    int(row.Algorithm),
		//nolint:gosec // G115: the value was stored from a uint32.
		SignCount:  uint32(row.SignCount),
		RPID:       row.RpID,
		Name:       row.Name,
		CreatedAt:  row.CreatedAt,
		LastUsedAt: row.LastUsedAt,
	}
}
