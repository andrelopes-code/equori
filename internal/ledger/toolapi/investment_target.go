package toolapi

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
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

	unit, err := resolveTargetUnit(ctx, svc, booksID, in, ids, &t)
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

// resolveTargetUnit gives the currency of the amounts: the Cash's, or the base currency for an
// opening, which moves no cash.
func resolveTargetUnit(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordInvestmentIn,
	ids investmentIDs,
	t *investmentTarget,
) (money.Currency, error) {
	if in.Kind != "opening" {
		return resolveTargetCash(ctx, svc, booksID, ids, t)
	}

	settings, err := svc.Settings(ctx, booksID)

	return settings.BaseCurrency, err
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

	if in.Kind == "opening" {
		return checkFields(action, given, []string{"date", "quantity", "unit_price"},
			"account_id", "brokerage_id", "instrument", "fees", "description")
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

// parseExchangeRate reads the optional exchange_rate of a proposal; nil when empty.
func parseExchangeRate(text string) (*money.Rate, error) {
	if text == "" {
		return nil, nil
	}

	rate, err := money.ParseRate(text)
	if err != nil {
		return nil, tool.InvalidArgument(
			"exchange_rate",
			"must be a positive decimal with at most 12 decimals",
		)
	}

	return &rate, nil
}

// rateStep holds what the preview needs to state the rate of an order and its base amount.
type rateStep struct {
	svc     *app.Service
	booksID int64
	date    time.Time
	given   *money.Rate
	text    string
}

// appendChanges adds the rate the record takes (the one given, or the stored close of the date)
// and the base amount: the amounts of plus less those of minus, each converted on its own as the
// record does. Nothing is added with cash in the base currency.
func (r rateStep) appendChanges(
	ctx context.Context,
	pv *tool.Preview,
	cash money.Currency,
	plus, minus []*money.Money,
) error {
	if cash == "" {
		return nil
	}

	rate, err := r.svc.CashRate(ctx, r.booksID, cash, r.date, r.given)
	if err != nil || rate == nil {
		return err
	}

	settings, err := r.svc.Settings(ctx, r.booksID)
	if err != nil {
		return err
	}

	base, err := domain.BaseTotal(*rate, settings.BaseCurrency, present(plus), present(minus))
	if err != nil {
		return tool.InvalidArgument("exchange_rate", "does not convert the amount: "+err.Error())
	}

	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "exchange_rate", After: tool.TextValue(r.rateText(rate))},
		tool.Change{Field: "base_amount", After: tool.MoneyValue(base)},
	)

	return nil
}

// appendTradeChanges states the rate and the base amount of a trade: a purchase or an opening
// costs the gross and the fees; a sale proceeds the gross less the fees and the taxes.
func (r rateStep) appendTradeChanges(
	ctx context.Context,
	pv *tool.Preview,
	o domain.TradeOrder,
	gross money.Money,
) error {
	if o.Side == domain.SideWriteOff {
		return nil
	}

	plus, minus := []*money.Money{&gross, o.Fees}, []*money.Money{}
	if o.Side == domain.SideSell {
		plus, minus = []*money.Money{&gross}, []*money.Money{o.Fees, o.Taxes}
	}

	return r.appendChanges(ctx, pv, gross.Currency(), plus, minus)
}

// rateText keeps the rate as typed; a stored rate prints in its canonical form.
func (r rateStep) rateText(rate *money.Rate) string {
	if r.given != nil {
		return r.text
	}

	return rate.String()
}

func present(parts []*money.Money) []money.Money {
	out := make([]money.Money, 0, len(parts))

	for _, m := range parts {
		if m != nil {
			out = append(out, *m)
		}
	}

	return out
}
