package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (r *Repository) SaveAccountInvitation(ctx context.Context, inv domain.AccountInvitation) (domain.AccountInvitation, error) {
	var stored domain.AccountInvitation

	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		if err := q.DeleteExpiredAccountInvitations(ctx, inv.CreatedAt); err != nil {
			return err
		}

		taken, err := q.MemberEmailExists(ctx, inv.Email)
		if err != nil {
			return err
		}

		if taken {
			return app.ErrEmailTaken
		}

		row, err := q.UpsertAccountInvitation(ctx, UpsertAccountInvitationParams{
			ID:           inv.ID,
			Email:        inv.Email,
			Region:       inv.Region,
			BaseCurrency: inv.BaseCurrency,
			TokenHash:    inv.TokenHash,
			InvitedBy:    inv.InvitedBy,
			CreatedAt:    inv.CreatedAt,
			ExpiresAt:    inv.ExpiresAt,
		})
		if err != nil {
			return err
		}

		stored = domain.AccountInvitation(row)

		return nil
	})
	if err != nil {
		return domain.AccountInvitation{}, err
	}

	return stored, nil
}

func (r *Repository) AccountInvitationPreview(ctx context.Context, tokenHash []byte, now time.Time) (app.InvitationPreview, error) {
	row, err := r.q.GetAccountInvitationPreview(ctx, GetAccountInvitationPreviewParams{TokenHash: tokenHash, ExpiresAt: now})
	if errors.Is(err, pgx.ErrNoRows) {
		return app.InvitationPreview{}, app.ErrInvitationNotFound
	}

	if err != nil {
		return app.InvitationPreview{}, err
	}

	return app.InvitationPreview{
		Kind:         app.InvitationKindAccount,
		InviterEmail: row.InviterEmail,
		Email:        row.Email,
		Role:         auth.RoleOwner,
	}, nil
}

func (r *Repository) AcceptAccountInvitation(ctx context.Context, tokenHash []byte, m domain.Member, now time.Time) (domain.Member, int64, error) {
	var (
		created domain.Member
		booksID int64
	)

	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		claim, err := r.q.WithTx(tx).ClaimAccountInvitation(ctx, ClaimAccountInvitationParams{TokenHash: tokenHash, ExpiresAt: now})
		if errors.Is(err, pgx.ErrNoRows) {
			return app.ErrInvitationNotFound
		}

		if err != nil {
			return err
		}

		created, booksID, err = r.insertMember(ctx, tx, m, claim.Region, money.Currency(claim.BaseCurrency), domain.DefaultBooksName(m.Email))

		return err
	})
	if err != nil {
		return domain.Member{}, 0, err
	}

	return created, booksID, nil
}
