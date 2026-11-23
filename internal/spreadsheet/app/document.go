package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/spreadsheet/domain"
)

func (s *Service) List(ctx context.Context, booksID int64) ([]domain.Summary, error) {
	return s.repo.ListDocuments(ctx, booksID)
}

func (s *Service) Document(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.Document, error) {
	return s.repo.Document(ctx, booksID, id)
}

func (s *Service) Create(
	ctx context.Context,
	booksID int64,
	name string,
	content []byte,
) (domain.Document, error) {
	name, err := domain.NewName(name)
	if err != nil {
		return domain.Document{}, err
	}

	if err := s.checkRoom(ctx, booksID); err != nil {
		return domain.Document{}, err
	}

	return s.repo.InsertDocument(ctx, booksID, name, content)
}

func (s *Service) Copy(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	name string,
) (domain.Summary, error) {
	name, err := domain.NewName(name)
	if err != nil {
		return domain.Summary{}, err
	}

	if _, err := s.repo.Document(ctx, booksID, id); err != nil {
		return domain.Summary{}, err
	}

	if err := s.checkRoom(ctx, booksID); err != nil {
		return domain.Summary{}, err
	}

	return s.repo.CopyDocument(ctx, booksID, id, name)
}

func (s *Service) Save(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	version int,
	content []byte,
) (domain.Summary, error) {
	return s.repo.UpdateContent(ctx, booksID, id, version, content)
}

func (s *Service) Rename(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	name string,
) (domain.Summary, error) {
	name, err := domain.NewName(name)
	if err != nil {
		return domain.Summary{}, err
	}

	return s.repo.RenameDocument(ctx, booksID, id, name)
}

func (s *Service) Delete(ctx context.Context, booksID int64, id uuid.UUID) error {
	return s.repo.DeleteDocument(ctx, booksID, id)
}

// checkRoom reads the count outside a lock: two creations at the limit can both pass, and the
// book then holds one document above it.
func (s *Service) checkRoom(ctx context.Context, booksID int64) error {
	n, err := s.repo.CountDocuments(ctx, booksID)
	if err != nil {
		return err
	}

	if n >= domain.MaxDocuments {
		return ErrLimitReached
	}

	return nil
}
