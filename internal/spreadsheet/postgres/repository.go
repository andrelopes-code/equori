// Package postgres stores spreadsheet documents.
package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/spreadsheet/app"
	"github.com/andrelopes-code/equori/internal/spreadsheet/domain"
)

var _ app.Repository = (*Repository)(nil)

type Repository struct {
	q *Queries
}

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{q: New(pool)} }

func (r *Repository) ListDocuments(ctx context.Context, booksID int64) ([]domain.Summary, error) {
	rows, err := r.q.ListDocuments(ctx, booksID)
	if err != nil {
		return nil, err
	}

	out := make([]domain.Summary, len(rows))
	for i, row := range rows {
		out[i] = toSummary(row.ID, row.Name, row.Version, row.CreatedAt, row.UpdatedAt)
	}

	return out, nil
}

func (r *Repository) CountDocuments(ctx context.Context, booksID int64) (int, error) {
	n, err := r.q.CountDocuments(ctx, booksID)

	return int(n), err
}

func (r *Repository) Document(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.Document, error) {
	row, err := r.q.GetDocument(ctx, GetDocumentParams{BooksID: booksID, ID: id})
	if err != nil {
		return domain.Document{}, notFound(err)
	}

	return toDocument(row), nil
}

func (r *Repository) InsertDocument(
	ctx context.Context,
	booksID int64,
	name string,
	content []byte,
) (domain.Document, error) {
	row, err := r.q.InsertDocument(
		ctx,
		InsertDocumentParams{BooksID: booksID, Name: name, Content: content},
	)
	if err != nil {
		return domain.Document{}, err
	}

	return toDocument(row), nil
}

func (r *Repository) CopyDocument(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	name string,
) (domain.Summary, error) {
	row, err := r.q.CopyDocument(ctx, CopyDocumentParams{BooksID: booksID, ID: id, Name: name})
	if err != nil {
		return domain.Summary{}, notFound(err)
	}

	return toSummary(row.ID, row.Name, row.Version, row.CreatedAt, row.UpdatedAt), nil
}

func (r *Repository) UpdateContent(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	version int,
	content []byte,
) (domain.Summary, error) {
	row, err := r.q.UpdateDocumentContent(ctx, UpdateDocumentContentParams{
		BooksID: booksID,
		ID:      id,
		Version: int32(version), //nolint:gosec // the contract bounds version to an int32.
		Content: content,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		// No row matched: the document is missing, or it holds another version.
		if _, err := r.Document(ctx, booksID, id); err != nil {
			return domain.Summary{}, err
		}

		return domain.Summary{}, app.ErrVersionConflict
	}

	if err != nil {
		return domain.Summary{}, err
	}

	return toSummary(row.ID, row.Name, row.Version, row.CreatedAt, row.UpdatedAt), nil
}

func (r *Repository) RenameDocument(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	name string,
) (domain.Summary, error) {
	row, err := r.q.RenameDocument(
		ctx,
		RenameDocumentParams{BooksID: booksID, ID: id, Name: name},
	)
	if err != nil {
		return domain.Summary{}, notFound(err)
	}

	return toSummary(row.ID, row.Name, row.Version, row.CreatedAt, row.UpdatedAt), nil
}

func (r *Repository) DeleteDocument(ctx context.Context, booksID int64, id uuid.UUID) error {
	n, err := r.q.DeleteDocument(ctx, DeleteDocumentParams{BooksID: booksID, ID: id})
	if err != nil {
		return err
	}

	if n == 0 {
		return app.ErrNotFound
	}

	return nil
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return app.ErrNotFound
	}

	return err
}

func toDocument(row SpreadsheetDocument) domain.Document {
	return domain.Document{
		Summary: toSummary(row.ID, row.Name, row.Version, row.CreatedAt, row.UpdatedAt),
		Content: row.Content,
	}
}

func toSummary(
	id uuid.UUID,
	name string,
	version int32,
	createdAt, updatedAt time.Time,
) domain.Summary {
	return domain.Summary{
		ID:        id,
		Name:      name,
		Version:   int(version),
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	}
}
