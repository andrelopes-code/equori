package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// investmentTarget is the Investment and the Cash of an order, in either form of BC6.
type investmentTarget struct {
	name       string
	instrument money.Currency
	cashUnit   money.Money
	cashName   string
}

// resolveInvestmentTarget names the account form or the pair form; the service resolves the
// Investment line and the default Cash at run time.
func resolveInvestmentTarget(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordInvestmentIn,
	ids investmentIDs,
) (investmentTarget, error) {
	pair := ids.brokerage != uuid.Nil && in.Instrument != ""
	if (ids.account != uuid.Nil) == pair ||
		(!pair && (ids.brokerage != uuid.Nil || in.Instrument != "")) {
		return investmentTarget{}, app.ErrTradeTargetRequired
	}

	var t investmentTarget

	if err := resolveTargetHolding(ctx, svc, booksID, in, ids, pair, &t); err != nil {
		return t, err
	}

	unit, err := resolveTargetCash(ctx, svc, booksID, ids, &t)
	if err != nil {
		return t, err
	}

	t.cashUnit, err = svc.AmountOf(ctx, 0, unit)

	return t, err
}

func resolveTargetHolding(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordInvestmentIn,
	ids investmentIDs,
	pair bool,
	t *investmentTarget,
) error {
	if !pair {
		security, err := svc.Account(ctx, booksID, ids.account)
		if err != nil {
			return err
		}

		t.name, t.instrument = security.Name, security.Instrument

		return nil
	}

	brokerage, err := svc.Account(ctx, booksID, ids.brokerage)
	if err != nil {
		return err
	}

	instrument, err := svc.ResolveCode(ctx, money.Currency(in.Instrument))
	if err != nil {
		return err
	}

	t.name, t.instrument = brokerage.Name, instrument

	return nil
}

func resolveTargetCash(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	ids investmentIDs,
	t *investmentTarget,
) (money.Currency, error) {
	if ids.cash == uuid.Nil {
		settings, err := svc.Settings(ctx, booksID)
		if err != nil {
			return "", err
		}

		return settings.BaseCurrency, nil
	}

	cash, err := svc.Account(ctx, booksID, ids.cash)
	if err != nil {
		return "", err
	}

	t.cashName = cash.Name

	return cash.Instrument, nil
}
