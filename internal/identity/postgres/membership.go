package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (r *Repository) TouchMembership(ctx context.Context, memberID, booksID int64, at time.Time) error {
	n, err := r.q.TouchMembership(ctx, TouchMembershipParams{MemberID: memberID, BooksID: booksID, LastActiveAt: at})
	if err != nil {
		return err
	}

	if n == 0 {
		return app.ErrNotFound
	}

	return nil
}

func (r *Repository) Members(ctx context.Context, booksID int64) ([]app.Membership, error) {
	rows, err := r.q.ListMembers(ctx, booksID)
	if err != nil {
		return nil, err
	}

	out := make([]app.Membership, 0, len(rows))
	for _, row := range rows {
		out = append(out, app.Membership{
			MemberID:    row.MemberID,
			Email:       row.Email,
			DisplayName: deref(row.DisplayName),
			Role:        auth.BookRole(row.Role),
			CreatedAt:   row.CreatedAt,
		})
	}

	return out, nil
}

func (r *Repository) ChangeRole(ctx context.Context, booksID, memberID int64, role auth.BookRole) error {
	return r.changeMembership(ctx, booksID, memberID, role != auth.RoleOwner, func(q *Queries) error {
		return q.UpdateMembershipRole(ctx, UpdateMembershipRoleParams{BooksID: booksID, MemberID: memberID, Role: string(role)})
	})
}

func (r *Repository) RemoveMembership(ctx context.Context, booksID, memberID int64) error {
	return r.changeMembership(ctx, booksID, memberID, true, func(q *Queries) error {
		return q.DeleteMembership(ctx, DeleteMembershipParams{BooksID: booksID, MemberID: memberID})
	})
}

// changeMembership runs apply under the lock of the book row (HA21); leaves is true when apply
// takes the owner role away from the membership, which then needs another owner.
func (r *Repository) changeMembership(ctx context.Context, booksID, memberID int64, leaves bool, apply func(*Queries) error) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		if err := q.LockBooks(ctx, booksID); err != nil {
			return err
		}

		stored, err := q.GetMembershipRole(ctx, GetMembershipRoleParams{BooksID: booksID, MemberID: memberID})
		if errors.Is(err, pgx.ErrNoRows) {
			return app.ErrMemberNotFound
		}

		if err != nil {
			return err
		}

		if auth.BookRole(stored) == auth.RoleOwner && leaves {
			others, err := q.CountOtherOwners(ctx, CountOtherOwnersParams{BooksID: booksID, MemberID: memberID})
			if err != nil {
				return err
			}

			if others == 0 {
				return app.ErrLastOwner
			}
		}

		return apply(q)
	})
}
