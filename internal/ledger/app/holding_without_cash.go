package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// writeOffHolding resolves the holding a write-off names by account_id, or by brokerage_id and
// instrument without creating it; no cash moves, so the cash side of the order is the base
// currency alone (listed options design W1, O8).
func (s *Service) writeOffHolding(
	ctx context.Context,
	r Repository,
	booksID int64,
	o *domain.TradeOrder,
	base money.Currency,
) (security, cash domain.Account, err error) {
	if o.CashAccountID != uuid.Nil {
		return domain.Account{}, domain.Account{}, fieldErr(
			"cash_account_id",
			"is not taken by a write-off",
			domain.ErrValidation,
		)
	}

	if err := checkTargetForm(target{
		AccountID: o.AccountID, BrokerageID: o.BrokerageID, Instrument: o.Instrument,
	}); err != nil {
		return domain.Account{}, domain.Account{}, err
	}

	if o.AccountID == uuid.Nil {
		_, o.AccountID, err = s.pairTarget(ctx, r, booksID, target{
			BrokerageID: o.BrokerageID, Instrument: o.Instrument,
		})
		if err != nil {
			return domain.Account{}, domain.Account{}, err
		}
	}

	security, err = loadAccount(ctx, r, booksID, o.AccountID, "account_id")
	if err != nil {
		return domain.Account{}, domain.Account{}, err
	}

	if o.Quantity.Currency() != security.Instrument {
		return domain.Account{}, domain.Account{}, fieldErr(
			"quantity",
			"must be an amount of "+string(security.Instrument),
			domain.ErrValidation,
		)
	}

	return security, domain.Account{Instrument: base}, nil
}

// openingHolding resolves the holding an opening names by account_id, or by brokerage_id and
// instrument, creating the holding as a purchase does; it returns the opening balances as the
// account the cost comes from, and moves the opening dates of the brokerage and the holding back
// to the date of the lot (investment history design OL1, OL3, OL4).
func (s *Service) openingHolding(
	ctx context.Context,
	r Repository,
	booksID int64,
	o *domain.TradeOrder,
) (security, equity domain.Account, err error) {
	if err := checkOpening(*o); err != nil {
		return domain.Account{}, domain.Account{}, err
	}

	brokerage, security, err := s.openingTarget(ctx, r, booksID, o)
	if err != nil {
		return domain.Account{}, domain.Account{}, err
	}

	if !security.HoldsSecurity() {
		return domain.Account{}, domain.Account{}, fieldErr(
			"account_id",
			"must hold a security",
			domain.ErrValidation,
		)
	}

	if o.Quantity.Currency() != security.Instrument {
		return domain.Account{}, domain.Account{}, fieldErr(
			"quantity",
			"must be an amount of "+string(security.Instrument),
			domain.ErrValidation,
		)
	}

	equity, err = r.SystemAccount(ctx, booksID, domain.RoleOpeningBalances)
	if err != nil {
		return domain.Account{}, domain.Account{}, err
	}

	for _, a := range []*domain.Account{&brokerage, &security} {
		if err := openedBy(ctx, r, a, o.Date); err != nil {
			return domain.Account{}, domain.Account{}, err
		}
	}

	o.AccountID, o.CashAccountID = security.ID, equity.ID

	return security, equity, nil
}

// checkOpening refuses the fields an opening does not take.
func checkOpening(o domain.TradeOrder) error {
	if o.CashAccountID != uuid.Nil {
		return fieldErr("cash_account_id", "is not taken by an opening", domain.ErrValidation)
	}

	if o.SettlementDate != nil {
		return fieldErr("settlement_date", "an opening has no settlement", domain.ErrValidation)
	}

	return nil
}

// openingTarget returns the brokerage and the holding the opening o names.
func (s *Service) openingTarget(
	ctx context.Context,
	r Repository,
	booksID int64,
	o *domain.TradeOrder,
) (brokerage, security domain.Account, err error) {
	t := target{
		AccountID: o.AccountID, BrokerageID: o.BrokerageID, Instrument: o.Instrument, Create: true,
	}
	if err := checkTargetForm(t); err != nil {
		return domain.Account{}, domain.Account{}, err
	}

	if o.AccountID != uuid.Nil {
		if security, err = loadAccount(ctx, r, booksID, o.AccountID, "account_id"); err != nil {
			return domain.Account{}, domain.Account{}, err
		}

		brokerage, err = parentOf(ctx, r, booksID, o.AccountID)

		return brokerage, security, err
	}

	brokerage, holdingID, err := s.pairTarget(ctx, r, booksID, t)
	if err != nil {
		return domain.Account{}, domain.Account{}, err
	}

	security, err = loadAccount(ctx, r, booksID, holdingID, "account_id")

	return brokerage, security, err
}

// openedBy moves the opening date of a back to date when it is later; an account without an
// id (a holding without a parent) is left as it is.
func openedBy(ctx context.Context, r Repository, a *domain.Account, date time.Time) error {
	if a.ID == uuid.Nil || !a.OpenedOn.After(date) {
		return nil
	}

	a.OpenedOn = date

	updated, err := r.UpdateAccount(ctx, *a)
	if err != nil {
		return err
	}

	*a = updated

	return nil
}
