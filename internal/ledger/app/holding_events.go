package app

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const instrumentTypeFund = "fund"

// RecordCorporateAction records a split, a reverse split, a bonus or a unit tax of one holding
// (A228 IO22, A236 FC25).
func (s *Service) RecordCorporateAction(
	ctx context.Context,
	booksID int64,
	o domain.ActionOrder,
) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		t, err := s.buildCorporateAction(ctx, r, booksID, o)
		if err != nil {
			return err
		}

		created, err = s.insert(ctx, r, t)

		return err
	})

	return created, err
}

// buildCorporateAction resolves the holding of o, reads what it held the day before and builds
// the transaction.
func (s *Service) buildCorporateAction(
	ctx context.Context,
	r Repository,
	booksID int64,
	o domain.ActionOrder,
) (domain.Transaction, error) {
	base, err := baseCurrency(ctx, r, booksID)
	if err != nil {
		return domain.Transaction{}, err
	}

	security, err := s.actionHolding(ctx, r, booksID, &o)
	if err != nil {
		return domain.Transaction{}, err
	}

	if o.UnitCost != nil && o.CategoryID != uuid.Nil {
		if err := checkIncomeCategory(ctx, r, booksID, o.CategoryID); err != nil {
			return domain.Transaction{}, err
		}
	}

	h, err := s.lockHolding(ctx, r, booksID, security, base, o.Date.AddDate(0, 0, -1), uuid.Nil)
	if err != nil {
		return domain.Transaction{}, err
	}

	if o.Kind == domain.ActionUnitTax {
		return s.buildUnitTax(ctx, r, booksID, o, security, h, base)
	}

	postings, action, err := domain.BuildCorporateAction(o, h, base)
	if err != nil {
		return domain.Transaction{}, err
	}

	return domain.Transaction{
		BooksID:           booksID,
		Date:              o.Date,
		Description:       o.Description,
		BalancingCurrency: base,
		Postings:          postings,
		CorporateAction:   &action,
	}, nil
}

// actionHolding resolves the holding named by o into o.AccountID; an action never creates it.
func (s *Service) actionHolding(
	ctx context.Context,
	r Repository,
	booksID int64,
	o *domain.ActionOrder,
) (domain.Account, error) {
	t := target{AccountID: o.AccountID, BrokerageID: o.BrokerageID, Instrument: o.Instrument}
	if err := checkTargetForm(t); err != nil {
		return domain.Account{}, err
	}

	if o.AccountID == uuid.Nil {
		_, holdingID, err := s.pairTarget(ctx, r, booksID, t)
		if err != nil {
			return domain.Account{}, err
		}

		o.AccountID = holdingID
	}

	security, err := loadAccount(ctx, r, booksID, o.AccountID, "account_id")
	if err != nil {
		return domain.Account{}, err
	}

	if !security.HoldsSecurity() {
		return domain.Account{}, fieldErr(
			"account_id",
			"must hold a security",
			domain.ErrValidation,
		)
	}

	return security, nil
}

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

	from, err := givingHolding(ctx, r, booksID, o)
	if err != nil {
		return domain.Transaction{}, err
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

	h, err = s.withCostMethod(ctx, r, booksID, from, h, o.Date, uuid.Nil)
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

// givingHolding loads the holding o moves out of and checks it can move to o's brokerage.
func givingHolding(
	ctx context.Context,
	r Repository,
	booksID int64,
	o domain.CustodyOrder,
) (domain.Account, error) {
	from, err := loadAccount(ctx, r, booksID, o.AccountID, "account_id")
	if err != nil {
		return domain.Account{}, err
	}

	if !from.HoldsSecurity() {
		return domain.Account{}, fieldErr(
			"account_id",
			"must hold a security",
			domain.ErrValidation,
		)
	}

	if from.ParentID == o.BrokerageID {
		return domain.Account{}, fieldErr(
			"brokerage_id",
			"must be another brokerage",
			domain.ErrValidation,
		)
	}

	return from, nil
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

// buildUnitTax builds the transaction of a unit tax on h, the holding of security the day
// before o.Date (A236 FC25).
func (s *Service) buildUnitTax(
	ctx context.Context,
	r Repository,
	booksID int64,
	o domain.ActionOrder,
	security domain.Account,
	h domain.Holding,
	base money.Currency,
) (domain.Transaction, error) {
	in, err := s.ins.Instrument(ctx, security.Instrument)
	if err != nil {
		return domain.Transaction{}, err
	}

	if in.Type != instrumentTypeFund {
		return domain.Transaction{}, fieldErr(
			"account_id",
			"a unit tax applies to a fund",
			domain.ErrValidation,
		)
	}

	adjustments, err := r.SystemAccount(ctx, booksID, domain.RoleAdjustments)
	if err != nil {
		return domain.Transaction{}, err
	}

	prepaid, err := prepaidTaxAccount(ctx, r, adjustments)
	if err != nil {
		return domain.Transaction{}, err
	}

	accounts := domain.UnitTaxAccounts{PrepaidTax: prepaid.ID, Adjustments: adjustments.ID}

	postings, action, err := domain.BuildUnitTax(o, h, base, accounts)
	if err != nil {
		return domain.Transaction{}, err
	}

	return domain.Transaction{
		BooksID:           booksID,
		Date:              o.Date,
		Description:       o.Description,
		BalancingCurrency: base,
		Postings:          postings,
		CorporateAction:   &action,
	}, nil
}

// prepaidTaxAccount returns the prepaid_tax account of the book, created by its first unit tax.
// The lock on the adjustments account serializes two first unit taxes of one book, so the
// unique index on (books_id, system_role) never rejects the second insert.
func prepaidTaxAccount(
	ctx context.Context,
	r Repository,
	adjustments domain.Account,
) (domain.Account, error) {
	if _, err := r.LockAccount(ctx, adjustments.BooksID, adjustments.ID); err != nil {
		return domain.Account{}, err
	}

	prepaid, err := r.SystemAccount(ctx, adjustments.BooksID, domain.RolePrepaidTax)
	if !errors.Is(err, ErrNotFound) {
		return prepaid, err
	}

	prepaid, err = domain.NewAccount(domain.Account{
		BooksID:    adjustments.BooksID,
		Name:       domain.RolePrepaidTax.DefaultName(),
		Class:      domain.RolePrepaidTax.Class(),
		Kind:       domain.RolePrepaidTax.Kind(),
		Instrument: adjustments.Instrument,
		OpenedOn:   earliestDate,
		SystemRole: domain.RolePrepaidTax,
	})
	if err != nil {
		return domain.Account{}, err
	}

	return r.InsertAccount(ctx, prepaid)
}
