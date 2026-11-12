package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

type Target = target

// ResolveTarget runs resolveTarget in its own transaction, as RecordTrade does.
func (s *Service) ResolveTarget(
	ctx context.Context,
	booksID int64,
	base money.Currency,
	o Target,
) (uuid.UUID, uuid.UUID, error) {
	var accountID, cashID uuid.UUID

	err := s.repo.InTx(ctx, func(r Repository) error {
		var err error

		accountID, cashID, err = s.resolveTarget(ctx, r, booksID, base, o)

		return err
	})

	return accountID, cashID, err
}

// BrokerageAccounts runs brokerageAccounts in its own transaction, as RecordTrade does.
func (s *Service) BrokerageAccounts(
	ctx context.Context,
	booksID int64,
	securityID, cashID uuid.UUID,
	base money.Currency,
) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		_, _, err := s.brokerageAccounts(ctx, r, booksID, securityID, cashID, base)

		return err
	})
}
