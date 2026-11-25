package toolapi

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
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
		return resolveDefaultCash(ctx, svc, booksID, ids, t)
	}

	cash, err := svc.Account(ctx, booksID, ids.cash)
	if err != nil {
		return "", err
	}

	t.cashName = cash.Name

	return cash.Instrument, nil
}

// resolveDefaultCash names the cash the service picks; no name without a single candidate.
func resolveDefaultCash(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	ids investmentIDs,
	t *investmentTarget,
) (money.Currency, error) {
	holder := ids.account
	if holder == uuid.Nil {
		holder = ids.brokerage
	}

	name, err := svc.DefaultCash(ctx, booksID, holder)
	if err != nil {
		return "", err
	}

	t.cashName = name
	settings, err := svc.Settings(ctx, booksID)

	return settings.BaseCurrency, err
}

type investmentIDs struct {
	account, brokerage, cash, category, taxesCategory, withheldCategory uuid.UUID
}

func parseInvestmentIDs(in recordInvestmentIn) (investmentIDs, error) {
	var ids investmentIDs

	var err error
	if ids.account, err = optionalID(in.AccountID, "account_id"); err != nil {
		return ids, err
	}

	if ids.brokerage, err = optionalID(in.BrokerageID, "brokerage_id"); err != nil {
		return ids, err
	}

	if ids.cash, err = optionalID(in.CashAccountID, "cash_account_id"); err != nil {
		return ids, err
	}

	if ids.category, err = optionalID(in.CategoryID, "category_id"); err != nil {
		return ids, err
	}

	if ids.taxesCategory, err = optionalID(in.TaxesCategoryID, "taxes_category_id"); err != nil {
		return ids, err
	}

	ids.withheldCategory, err = optionalID(in.WithheldCategoryID, "withheld_category_id")

	return ids, err
}

func checkInvestmentFields(in recordInvestmentIn) error {
	action := string(in.Kind)
	given := map[string]bool{
		"account_id":           in.AccountID != "",
		"brokerage_id":         in.BrokerageID != "",
		"instrument":           in.Instrument != "",
		"cash_account_id":      in.CashAccountID != "",
		"date":                 !in.Date.IsZero(),
		"quantity":             in.Quantity != "",
		"unit_price":           in.UnitPrice != "",
		"fees":                 in.Fees != "",
		"taxes":                in.Taxes != "",
		"settlement_date":      !in.SettledOn.IsZero(),
		"gross":                in.Gross != "",
		"withheld":             in.Withheld != "",
		"income_type":          in.IncomeType != "",
		"category_id":          in.CategoryID != "",
		"description":          in.Description != "",
		"taxes_category_id":    in.TaxesCategoryID != "",
		"withheld_category_id": in.WithheldCategoryID != "",
	}
	// transaction_id and reason serve every kind; loadCorrection checks them.
	target := []string{"account_id", "brokerage_id", "instrument", "cash_account_id"}

	if in.Kind == "income" {
		return checkFields(action, given, []string{"date", "gross", "income_type", "category_id"},
			append(target, "withheld", "description", "withheld_category_id")...)
	}

	if in.Kind == "write_off" {
		return checkFields(action, given, []string{"date", "quantity"},
			"account_id", "brokerage_id", "instrument", "description")
	}

	return checkFields(action, given, []string{"date", "quantity", "unit_price"},
		append(target, "fees", "taxes", "settlement_date", "description", "taxes_category_id")...)
}

func grossOf(quantity money.Money, price money.Rate, cash money.Currency) (money.Money, error) {
	gross, err := money.Convert(quantity, cash, money.Leg{Rate: price})
	if err != nil {
		return money.Money{}, fmt.Errorf("convert gross amount: %w", err)
	}

	return gross, nil
}

// subtract takes each part given from total.
func subtract(total money.Money, parts ...*money.Money) (money.Money, error) {
	for _, part := range parts {
		if part == nil {
			continue
		}

		var err error
		if total, err = total.Sub(*part); err != nil {
			return money.Money{}, fmt.Errorf("subtract from the net: %w", err)
		}
	}

	return total, nil
}

func appendMoneyChange(pv *tool.Preview, field string, m *money.Money) {
	if m != nil {
		pv.Changes = append(pv.Changes, tool.Change{Field: field, After: tool.MoneyValue(*m)})
	}
}
