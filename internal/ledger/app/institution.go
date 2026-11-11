package app

import (
	"context"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

func (s *Service) CreateInstitution(ctx context.Context, booksID int64, i Institution) (Institution, error) {
	if i.Name == "" || len([]rune(i.Name)) > 120 {
		return Institution{}, &domain.FieldError{Field: "name", Message: "must have 1 to 120 characters", Err: domain.ErrValidation}
	}

	if err := validateInstitutionIdentifier(i.Identifier); err != nil {
		return Institution{}, err
	}

	i.BooksID = booksID

	return s.repo.InsertInstitution(ctx, i)
}

// SetInstitutionIdentifier sets the identifier of an institution, or clears it when ident is empty (ADR 013).
func (s *Service) SetInstitutionIdentifier(ctx context.Context, booksID int64, id uuid.UUID, ident InstitutionIdentifier) (Institution, error) {
	if err := validateInstitutionIdentifier(ident); err != nil {
		return Institution{}, err
	}

	return s.repo.SetInstitutionIdentifier(ctx, booksID, id, ident)
}

// DeleteInstitution removes an institution no account uses.
func (s *Service) DeleteInstitution(ctx context.Context, booksID int64, id uuid.UUID) error {
	return s.repo.DeleteInstitution(ctx, booksID, id)
}

// InstitutionIdentifierSchemes lists the schemes an institution identifier may use.
func (s *Service) InstitutionIdentifierSchemes() []domain.IdentifierScheme {
	return domain.IdentifierSchemes()
}

func (s *Service) ListInstitutions(ctx context.Context, booksID int64, p page.Request[InstitutionKey]) ([]Institution, *InstitutionKey, error) {
	return s.repo.ListInstitutions(ctx, booksID, p)
}

func validateInstitutionIdentifier(ident InstitutionIdentifier) error {
	if ident == (InstitutionIdentifier{}) {
		return nil
	}

	return domain.ValidateIdentifier(ident.Scheme, ident.Value)
}
