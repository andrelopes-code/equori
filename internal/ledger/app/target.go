package app

import (
	"bytes"
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

var (
	ErrTradeTargetRequired = errors.New(
		"name account_id, or brokerage_id with instrument, not both",
	)
	ErrBrokerageCashMissing = errors.New(
		"the brokerage has no open cash account in the base currency; " +
			"create a cash account named Cash in the brokerage, " +
			"or name an account of its institution in cash_account_id",
	)
	ErrBrokerageCashAmbiguous = errors.New(
		"the brokerage has several cash accounts; " +
			"name one in cash_account_id, or close the cash account that has no entry",
	)
	ErrHoldingNotFound = errors.New("the brokerage holds no such investment")
)

// target names the holding of a trade or income in one of two forms: AccountID, or
// BrokerageID with Instrument (BC6). Create allows the pair to create the holding.
type target struct {
	AccountID, CashAccountID, BrokerageID uuid.UUID
	Instrument                            money.Currency
	Create                                bool
}

// resolveTarget returns the holding and the cash account of a trade. With the pair form it
// locks the brokerage row, so two first purchases of one instrument create one holding.
func (s *Service) resolveTarget(
	ctx context.Context,
	r Repository,
	booksID int64,
	base money.Currency,
	o target,
) (accountID, cashID uuid.UUID, err error) {
	if err := checkTargetForm(o); err != nil {
		return uuid.Nil, uuid.Nil, err
	}

	var brokerage domain.Account

	accountID = o.AccountID

	if o.AccountID == uuid.Nil {
		brokerage, accountID, err = s.pairTarget(ctx, r, booksID, o)
		if err != nil {
			return uuid.Nil, uuid.Nil, err
		}
	}

	if o.CashAccountID != uuid.Nil {
		return accountID, o.CashAccountID, nil
	}

	if brokerage.ID == uuid.Nil {
		brokerage, err = parentOf(ctx, r, booksID, accountID)
		if err != nil {
			return uuid.Nil, uuid.Nil, err
		}
	}

	cashID, err = defaultCash(ctx, r, brokerage, base)

	return accountID, cashID, err
}

// pairTarget returns the locked brokerage and its holding of the instrument.
func (s *Service) pairTarget(
	ctx context.Context,
	r Repository,
	booksID int64,
	o target,
) (brokerage domain.Account, holdingID uuid.UUID, err error) {
	brokerage, err = s.lockBrokerage(ctx, r, booksID, o.BrokerageID)
	if err != nil {
		return domain.Account{}, uuid.Nil, err
	}

	holding, err := s.findOrCreateHolding(ctx, r, brokerage, o)
	if err != nil {
		return domain.Account{}, uuid.Nil, err
	}

	return brokerage, holding.ID, nil
}

// parentOf returns the parent of the account; the zero Account when it has none.
func parentOf(
	ctx context.Context,
	r Repository,
	booksID int64,
	id uuid.UUID,
) (domain.Account, error) {
	child, err := loadAccount(ctx, r, booksID, id, "account_id")
	if err != nil || child.ParentID == uuid.Nil {
		return domain.Account{}, err
	}

	return loadAccount(ctx, r, booksID, child.ParentID, "account_id")
}

// checkTargetForm requires exactly one of account_id and the pair.
func checkTargetForm(o target) error {
	pair := o.BrokerageID != uuid.Nil && o.Instrument != ""
	half := (o.BrokerageID != uuid.Nil || o.Instrument != "") && !pair

	if half || (o.AccountID != uuid.Nil) == pair {
		return ErrTradeTargetRequired
	}

	return nil
}

func (s *Service) lockBrokerage(
	ctx context.Context,
	r Repository,
	booksID int64,
	id uuid.UUID,
) (domain.Account, error) {
	brokerage, err := r.LockAccount(ctx, booksID, id)
	if errors.Is(err, ErrNotFound) {
		return domain.Account{}, fieldErr(
			"brokerage_id",
			"unknown account",
			domain.ErrUnknownAccount,
		)
	}

	if err != nil {
		return domain.Account{}, err
	}

	if brokerage.Kind != domain.KindBrokerage || brokerage.HoldsSecurity() {
		return domain.Account{}, fieldErr(
			"brokerage_id",
			"must be a brokerage account",
			domain.ErrValidation,
		)
	}

	return brokerage, nil
}

func (s *Service) findOrCreateHolding(
	ctx context.Context,
	r Repository,
	brokerage domain.Account,
	o target,
) (domain.Account, error) {
	children, err := r.ChildAccounts(ctx, brokerage.BooksID, brokerage.ID)
	if err != nil {
		return domain.Account{}, err
	}

	for _, c := range children {
		if c.Instrument != o.Instrument {
			continue
		}

		if c.ClosedOn != nil {
			return domain.Account{}, fieldErr(
				"instrument",
				fmt.Sprintf("the holding account %q is closed", c.Name),
				domain.ErrValidation,
			)
		}

		return c, nil
	}

	if !o.Create {
		return domain.Account{}, ErrHoldingNotFound
	}

	return s.createHolding(ctx, r, brokerage, o.Instrument)
}

func (s *Service) createHolding(
	ctx context.Context,
	r Repository,
	brokerage domain.Account,
	instrument money.Currency,
) (domain.Account, error) {
	holding := domain.Account{
		BooksID:       brokerage.BooksID,
		Name:          string(instrument),
		Class:         domain.ClassAsset,
		Kind:          domain.KindBrokerage,
		Instrument:    instrument,
		ParentID:      brokerage.ID,
		InstitutionID: brokerage.InstitutionID,
		OpenedOn:      brokerage.OpenedOn,
	}

	if err := s.describeInstrument(ctx, &holding); err != nil {
		return domain.Account{}, onInstrument(err)
	}

	holding, err := domain.NewAccount(holding)
	if err != nil {
		return domain.Account{}, onInstrument(err)
	}

	if err := domain.ValidateParent(holding, brokerage); err != nil {
		return domain.Account{}, onInstrument(err)
	}

	return r.InsertAccount(ctx, holding)
}

// onInstrument names the field instrument where a check of the holding names currency.
func onInstrument(err error) error {
	var fe *domain.FieldError
	if errors.As(err, &fe) && fe.Field == "currency" {
		return fieldErr("instrument", fe.Message, fe.Err)
	}

	return err
}

// defaultCash returns the single paying account of the brokerage (BC14): its open cash
// accounts in the base currency and the open asset accounts of its institution outside its
// tree that are not brokerage accounts.
func defaultCash(
	ctx context.Context,
	r Repository,
	brokerage domain.Account,
	base money.Currency,
) (uuid.UUID, error) {
	children, err := r.ChildAccounts(ctx, brokerage.BooksID, brokerage.ID)
	if err != nil {
		return uuid.Nil, err
	}

	var found []uuid.UUID

	for _, c := range children {
		if c.Instrument == base && c.ClosedOn == nil {
			found = append(found, c.ID)
		}
	}

	outside, err := institutionCash(ctx, r, brokerage, base)
	if err != nil {
		return uuid.Nil, err
	}

	found = append(found, outside...)

	switch len(found) {
	case 0:
		return uuid.Nil, ErrBrokerageCashMissing
	case 1:
		return found[0], nil
	}

	return uuid.Nil, ErrBrokerageCashAmbiguous
}

func institutionCash(
	ctx context.Context,
	r Repository,
	brokerage domain.Account,
	base money.Currency,
) ([]uuid.UUID, error) {
	if brokerage.InstitutionID == uuid.Nil {
		return nil, nil
	}

	accounts, err := r.InstitutionAccounts(ctx, brokerage.BooksID, brokerage.InstitutionID)
	if err != nil {
		return nil, err
	}

	var found []uuid.UUID

	for _, a := range accounts {
		if a.Instrument == base && a.Kind != domain.KindBrokerage && a.ID != brokerage.ID &&
			a.ParentID != brokerage.ID {
			found = append(found, a.ID)
		}
	}

	return found, nil
}

// payingAccount reports whether cash is an open asset account that holds no security and is
// a cash account of the brokerage of security or an account of the institution of that
// brokerage (BC13).
func payingAccount(
	ctx context.Context,
	r Repository,
	security, cash domain.Account,
) (bool, error) {
	if cash.HoldsSecurity() || cash.Class != domain.ClassAsset || cash.ClosedOn != nil {
		return false, nil
	}

	if cash.ParentID == security.ParentID {
		return true, nil
	}

	brokerage, err := loadAccount(ctx, r, security.BooksID, security.ParentID, "account_id")
	if err != nil {
		return false, err
	}

	return brokerage.InstitutionID != uuid.Nil && cash.InstitutionID == brokerage.InstitutionID, nil
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
