package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (r *Repository) SaveInvitation(ctx context.Context, inv domain.Invitation) (domain.Invitation, error) {
	var stored domain.Invitation

	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		if err := q.DeleteExpiredInvitations(ctx, DeleteExpiredInvitationsParams{BooksID: inv.BooksID, ExpiresAt: inv.CreatedAt}); err != nil {
			return err
		}

		member, err := q.IsBooksMemberEmail(ctx, IsBooksMemberEmailParams{BooksID: inv.BooksID, Email: inv.Email})
		if err != nil {
			return err
		}

		if member {
			return app.ErrAlreadyMember
		}

		row, err := q.UpsertInvitation(ctx, UpsertInvitationParams{
			ID:        inv.ID,
			BooksID:   inv.BooksID,
			Email:     inv.Email,
			Role:      inv.Role,
			TokenHash: inv.TokenHash,
			InvitedBy: inv.InvitedBy,
			CreatedAt: inv.CreatedAt,
			ExpiresAt: inv.ExpiresAt,
		})
		if err != nil {
			return err
		}

		stored = toInvitation(row)

		return nil
	})
	if err != nil {
		return domain.Invitation{}, err
	}

	return stored, nil
}

func (r *Repository) Invitations(ctx context.Context, booksID int64, now time.Time) ([]domain.Invitation, error) {
	var out []domain.Invitation

	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		if err := q.DeleteExpiredInvitations(ctx, DeleteExpiredInvitationsParams{BooksID: booksID, ExpiresAt: now}); err != nil {
			return err
		}

		rows, err := q.ListInvitations(ctx, booksID)
		if err != nil {
			return err
		}

		out = make([]domain.Invitation, 0, len(rows))
		for _, row := range rows {
			out = append(out, toInvitation(row))
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return out, nil
}

func (r *Repository) DeleteInvitation(ctx context.Context, booksID int64, id uuid.UUID) error {
	n, err := r.q.DeleteInvitation(ctx, DeleteInvitationParams{BooksID: booksID, ID: id})
	if err != nil {
		return err
	}

	if n == 0 {
		return app.ErrInvitationNotFound
	}

	return nil
}

func (r *Repository) InvitationPreview(ctx context.Context, tokenHash []byte, now time.Time) (app.InvitationPreview, error) {
	row, err := r.q.GetInvitationPreview(ctx, GetInvitationPreviewParams{TokenHash: tokenHash, ExpiresAt: now})
	if errors.Is(err, pgx.ErrNoRows) {
		return app.InvitationPreview{}, app.ErrInvitationNotFound
	}

	if err != nil {
		return app.InvitationPreview{}, err
	}

	return app.InvitationPreview{
		BooksID:      row.BooksID,
		BooksName:    row.BooksName,
		InviterEmail: row.InviterEmail,
		Email:        row.Email,
		Role:         auth.BookRole(row.Role),
		MemberExists: row.MemberExists,
	}, nil
}

func (r *Repository) AcceptAsNewMember(ctx context.Context, tokenHash []byte, m domain.Member, now time.Time) (domain.Member, int64, error) {
	var (
		created domain.Member
		booksID int64
	)

	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		claim, err := q.ClaimInvitation(ctx, ClaimInvitationParams{TokenHash: tokenHash, ExpiresAt: now})
		if errors.Is(err, pgx.ErrNoRows) {
			return app.ErrInvitationNotFound
		}

		if err != nil {
			return err
		}

		row, err := q.CreateMember(ctx, CreateMemberParams{
			Email:        m.Email,
			PasswordHash: m.PasswordHash,
			Role:         string(m.Role),
			Language:     m.Language,
		})
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
			return app.ErrEmailTaken
		}

		if err != nil {
			return err
		}

		if err := q.CreateMembership(ctx, CreateMembershipParams{MemberID: row.ID, BooksID: claim.BooksID, Role: claim.Role}); err != nil {
			return err
		}

		created, booksID = toMember(row), claim.BooksID

		return nil
	})
	if err != nil {
		return domain.Member{}, 0, err
	}

	return created, booksID, nil
}

func (r *Repository) AcceptAsMember(ctx context.Context, tokenHash []byte, memberID int64, sessionHash []byte, now time.Time) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		claim, err := q.ClaimInvitation(ctx, ClaimInvitationParams{TokenHash: tokenHash, ExpiresAt: now})
		if errors.Is(err, pgx.ErrNoRows) {
			return app.ErrInvitationNotFound
		}

		if err != nil {
			return err
		}

		err = q.CreateMembership(ctx, CreateMembershipParams{MemberID: memberID, BooksID: claim.BooksID, Role: claim.Role})
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
			return app.ErrAlreadyMember
		}

		if err != nil {
			return err
		}

		if _, err := q.TouchMembership(ctx, TouchMembershipParams{MemberID: memberID, BooksID: claim.BooksID, LastActiveAt: now}); err != nil {
			return err
		}

		n, err := q.SwitchSession(ctx, SwitchSessionParams{TokenHash: sessionHash, MemberID: memberID, BooksID: claim.BooksID})
		if err != nil {
			return err
		}

		if n == 0 {
			return app.ErrUnauthenticated
		}

		return nil
	})
}

func toInvitation(row IdentityInvitation) domain.Invitation {
	return domain.Invitation(row)
}
