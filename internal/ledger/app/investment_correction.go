package app

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

// CorrectTrade stores the trade built from o as the next version of the trade id (A227).
func (s *Service) CorrectTrade(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	expectedVersion int,
	o domain.TradeOrder,
	reason string,
) (domain.Transaction, error) {
	if err := requireReason(reason); err != nil {
		return domain.Transaction{}, err
	}

	var corrected domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		prev, err := r.LockTransaction(ctx, booksID, id)
		if err != nil {
			return err
		}

		if prev.Trade == nil {
			return ErrNotFound
		}

		base, err := baseCurrency(ctx, r, booksID)
		if err != nil {
			return err
		}

		security, cash, err := s.resolveTrade(ctx, r, booksID, &o, base)
		if err != nil {
			return err
		}

		next, err := s.buildTrade(ctx, r, booksID, o, security, cash, base, id)
		if err != nil {
			return err
		}

		corrected, err = s.correctIn(
			ctx,
			r,
			booksID,
			id,
			expectedVersion,
			keptBy(prev, next),
			reason,
		)

		return err
	})

	return corrected, err
}

// CorrectIncome stores the income built from o as the next version of the income id (A227).
func (s *Service) CorrectIncome(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	expectedVersion int,
	o domain.IncomeOrder,
	reason string,
) (domain.Transaction, error) {
	if err := requireReason(reason); err != nil {
		return domain.Transaction{}, err
	}

	var corrected domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		prev, err := r.LockTransaction(ctx, booksID, id)
		if err != nil {
			return err
		}

		if prev.Income == nil {
			return ErrNotFound
		}

		next, err := s.buildIncome(ctx, r, booksID, o)
		if err != nil {
			return err
		}

		corrected, err = s.correctIn(
			ctx,
			r,
			booksID,
			id,
			expectedVersion,
			keptBy(prev, next),
			reason,
		)

		return err
	})

	return corrected, err
}

func requireReason(reason string) error {
	if strings.TrimSpace(reason) == "" {
		return fieldErr("reason", "is required", domain.ErrValidation)
	}

	return nil
}

// keptBy returns next with the payee, tags and links of prev, which the order does not name.
func keptBy(prev, next domain.Transaction) domain.Transaction {
	next.PayeeID, next.Tags, next.Links = prev.PayeeID, prev.Tags, prev.Links
	if next.Links == nil {
		// correctTo keeps the links of prev only for a nil list; an empty one clears them.
		next.Links = []domain.Link{}
	}

	return next
}
