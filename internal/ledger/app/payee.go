package app

import (
	"context"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

func (s *Service) CreatePayee(ctx context.Context, booksID int64, name string) (Payee, error) {
	if name == "" || len([]rune(name)) > 120 {
		return Payee{}, &domain.FieldError{Field: "name", Message: "must have 1 to 120 characters", Err: domain.ErrValidation}
	}

	return s.repo.InsertPayee(ctx, Payee{BooksID: booksID, Name: name})
}

func (s *Service) ListPayees(ctx context.Context, booksID int64, p page.Request[PayeeKey]) ([]Payee, *PayeeKey, error) {
	return s.repo.ListPayees(ctx, booksID, p)
}

func (s *Service) PayeeNames(ctx context.Context, booksID int64, ids []uuid.UUID) (map[uuid.UUID]string, error) {
	return s.repo.PayeeNames(ctx, booksID, ids)
}
