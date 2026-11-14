package app

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// RecordCustodyTransfer moves units of a holding to another brokerage with their cost
// (A228 IO29).
func (s *Service) RecordCustodyTransfer(
	ctx context.Context,
	booksID int64,
	o domain.CustodyOrder,
) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		t, err := s.buildCustodyTransfer(ctx, r, booksID, o)
		if err != nil {
			return err
		}

		created, err = s.insert(ctx, r, t)

		return err
	})

	return created, err
}

// buildCustodyTransfer resolves both holdings of o, reads the giving one at the end of the
// date and builds the transaction.
func (s *Service) buildCustodyTransfer(
	ctx context.Context,
	r Repository,
	booksID int64,
	o domain.CustodyOrder,
) (domain.Transaction, error) {
	base, err := baseCurrency(ctx, r, booksID)
	if err != nil {
		return domain.Transaction{}, err
	}

	from, err := loadAccount(ctx, r, booksID, o.AccountID, "account_id")
	if err != nil {
		return domain.Transaction{}, err
	}

	if !from.HoldsSecurity() {
		return domain.Transaction{}, fieldErr(
			"account_id",
			"must hold a security",
			domain.ErrValidation,
		)
	}

	if from.ParentID == o.BrokerageID {
		return domain.Transaction{}, fieldErr(
			"brokerage_id",
			"must be another brokerage",
			domain.ErrValidation,
		)
	}

	to, err := s.receivingHolding(ctx, r, from, o.BrokerageID)
	if err != nil {
		return domain.Transaction{}, err
	}

	if err := lockPair(ctx, r, booksID, from.ID, to.ID); err != nil {
		return domain.Transaction{}, err
	}

	h, err := s.lockHolding(ctx, r, booksID, from, base, o.Date, uuid.Nil)
	if err != nil {
		return domain.Transaction{}, err
	}

	postings, err := domain.BuildCustodyTransfer(o, to.ID, h)
	if err != nil {
		return domain.Transaction{}, err
	}

	description, err := s.custodyDescription(ctx, booksID, o.Description, from.Instrument)
	if err != nil {
		return domain.Transaction{}, err
	}

	return domain.Transaction{
		BooksID:           booksID,
		Date:              o.Date,
		Description:       description,
		BalancingCurrency: base,
		Postings:          postings,
	}, nil
}

// custodyDescription is the description given, else the ledger's wording of a custody transfer
// of code in the book's language (A228 IO31).
func (s *Service) custodyDescription(
	ctx context.Context,
	booksID int64,
	given string,
	code money.Currency,
) (string, error) {
	if strings.TrimSpace(given) != "" {
		return given, nil
	}

	w, err := s.writerFor(ctx, booksID)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf(w.CustodyTransfer, code), nil
}

// receivingHolding returns the holding of the instrument of from under the brokerage,
// created when absent (A228 IO30).
func (s *Service) receivingHolding(
	ctx context.Context,
	r Repository,
	from domain.Account,
	brokerageID uuid.UUID,
) (domain.Account, error) {
	brokerage, err := s.lockBrokerage(ctx, r, from.BooksID, brokerageID)
	if err != nil {
		return domain.Account{}, err
	}

	return s.findOrCreateHolding(
		ctx,
		r,
		brokerage,
		target{Instrument: from.Instrument, Create: true},
	)
}

// lockPair locks two accounts in ID order, so two transfers in opposite directions cannot wait
// on each other.
func lockPair(ctx context.Context, r Repository, booksID int64, a, b uuid.UUID) error {
	if bytes.Compare(a[:], b[:]) > 0 {
		a, b = b, a
	}

	for _, id := range []uuid.UUID{a, b} {
		if _, err := r.LockAccount(ctx, booksID, id); err != nil {
			return err
		}
	}

	return nil
}
