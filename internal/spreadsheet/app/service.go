// Package app implements the spreadsheet use cases.
package app

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/spreadsheet/domain"
)

var (
	ErrNotFound        = errors.New("not found")
	ErrVersionConflict = errors.New("the spreadsheet was saved by another session")
	ErrLimitReached    = errors.New("the book holds the most spreadsheets it can")
)

// Repository stores documents; postgres/ implements it. It returns ErrNotFound for a missing row.
type Repository interface {
	ListDocuments(ctx context.Context, booksID int64) ([]domain.Summary, error)
	CountDocuments(ctx context.Context, booksID int64) (int, error)
	Document(ctx context.Context, booksID int64, id uuid.UUID) (domain.Document, error)
	InsertDocument(
		ctx context.Context,
		booksID int64,
		name string,
		content []byte,
	) (domain.Document, error)
	CopyDocument(
		ctx context.Context,
		booksID int64,
		id uuid.UUID,
		name string,
	) (domain.Summary, error)
	// UpdateContent writes content when the stored version is version. It returns
	// ErrVersionConflict when the row holds another version.
	UpdateContent(
		ctx context.Context,
		booksID int64,
		id uuid.UUID,
		version int,
		content []byte,
	) (domain.Summary, error)
	RenameDocument(
		ctx context.Context,
		booksID int64,
		id uuid.UUID,
		name string,
	) (domain.Summary, error)
	DeleteDocument(ctx context.Context, booksID int64, id uuid.UUID) error
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service { return &Service{repo: repo} }
