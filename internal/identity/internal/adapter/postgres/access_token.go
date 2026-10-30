package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
)

func (r *Repository) CreateAccessToken(ctx context.Context, t domain.AccessToken) error {
	if err := r.q.CreateAccessToken(ctx, CreateAccessTokenParams{
		ID: t.ID, MemberID: t.MemberID, BooksID: t.BooksID, Name: t.Name, Scope: t.Scope, TokenHash: t.TokenHash, CreatedAt: t.CreatedAt, ExpiresAt: t.ExpiresAt,
	}); err != nil {
		return fmt.Errorf("create access token: %w", err)
	}

	return nil
}

func (r *Repository) AccessTokens(ctx context.Context, memberID, booksID int64) ([]domain.AccessToken, error) {
	rows, err := r.q.ListAccessTokens(ctx, ListAccessTokensParams{MemberID: memberID, BooksID: booksID})
	if err != nil {
		return nil, fmt.Errorf("list access tokens: %w", err)
	}

	out := make([]domain.AccessToken, 0, len(rows))
	for _, row := range rows {
		out = append(out, domain.AccessToken{
			ID: row.ID, MemberID: row.MemberID, BooksID: row.BooksID, Name: row.Name, Scope: row.Scope, CreatedAt: row.CreatedAt, ExpiresAt: row.ExpiresAt, LastUsedAt: row.LastUsedAt,
		})
	}

	return out, nil
}

func (r *Repository) DeleteAccessToken(ctx context.Context, memberID int64, id uuid.UUID) error {
	n, err := r.q.DeleteAccessToken(ctx, DeleteAccessTokenParams{MemberID: memberID, ID: id})
	if err != nil {
		return fmt.Errorf("delete access token: %w", err)
	}

	if n == 0 {
		return app.ErrAccessTokenNotFound
	}

	return nil
}

func (r *Repository) AccessTokenByHash(ctx context.Context, hash []byte, now time.Time) (domain.AccessToken, error) {
	row, err := r.q.GetAccessTokenByHash(ctx, GetAccessTokenByHashParams{TokenHash: hash, ExpiresAt: now})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AccessToken{}, app.ErrNotFound
	}

	if err != nil {
		return domain.AccessToken{}, fmt.Errorf("get access token: %w", err)
	}

	return domain.AccessToken{
		ID: row.ID, MemberID: row.MemberID, BooksID: row.BooksID, Name: row.Name, Scope: row.Scope, Role: row.BookRole, TokenHash: hash, CreatedAt: row.CreatedAt, ExpiresAt: row.ExpiresAt, LastUsedAt: row.LastUsedAt,
	}, nil
}

func (r *Repository) TouchAccessToken(ctx context.Context, t domain.AccessToken, now time.Time) error {
	if err := r.q.TouchAccessToken(ctx, TouchAccessTokenParams{MemberID: t.MemberID, ID: t.ID, LastUsedAt: &now}); err != nil {
		return fmt.Errorf("touch access token: %w", err)
	}

	return nil
}
