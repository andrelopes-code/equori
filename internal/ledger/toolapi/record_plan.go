package toolapi

import (
	"context"
	"strconv"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type destination struct {
	account domain.Account
	amount  money.Money
}

// recordPlan is a record_transaction request resolved against the book's accounts.
type recordPlan struct {
	from     domain.Account
	amount   money.Money
	dests    []destination
	payeeID  uuid.UUID
	toAmount money.Money // set for an exchange
	fee      *money.Money
	feeID    uuid.UUID
	exchange bool
	original money.Money // set for a foreign purchase
	rate     money.Rate
	foreign  bool
}

func planRecord(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordTransactionIn,
) (recordPlan, error) {
	var p recordPlan

	fromID, err := requiredID(in.FromAccountID, "from_account_id")
	if err != nil {
		return p, err
	}

	if p.from, err = svc.Account(ctx, booksID, fromID); err != nil {
		return p, err
	}

	unit, err := svc.AmountOf(ctx, 0, p.from.Instrument)
	if err != nil {
		return p, err
	}

	if p.amount, err = tool.ParsePositive("amount", in.Amount, unit); err != nil {
		return p, err
	}

	if p.payeeID, err = optionalID(in.PayeeID, "payee_id"); err != nil {
		return p, err
	}

	targets, err := recordTargetsOf(in)
	if err != nil {
		return p, err
	}

	if err = planRecordDestinations(ctx, svc, booksID, in, targets, unit, &p); err != nil {
		return p, err
	}

	if err = planRecordKind(ctx, svc, in, &p); err != nil {
		return p, err
	}

	if err := planExchangeFee(ctx, svc, booksID, in, &p); err != nil {
		return p, err
	}

	return p, nil
}

type recordTarget struct {
	field, id, amount string
}

func recordTargetsOf(in recordTransactionIn) ([]recordTarget, error) {
	var targets []recordTarget
	switch {
	case len(in.Splits) > 0 && in.ToAccountID != "":
		return nil, tool.InvalidArgument("splits", "cannot be combined with to_account_id")
	case len(in.Splits) > 0:
		for i, s := range in.Splits {
			targets = append(
				targets,
				recordTarget{
					"splits[" + strconv.Itoa(i) + "].to_account_id",
					s.ToAccountID,
					s.Amount,
				},
			)
		}
	case in.ToAccountID == "":
		return nil, tool.InvalidArgument("to_account_id", "is required without splits")
	default:
		targets = []recordTarget{{"to_account_id", in.ToAccountID, in.Amount}}
	}

	return targets, nil
}

func planRecordDestinations(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordTransactionIn,
	targets []recordTarget,
	unit money.Money,
	p *recordPlan,
) error {
	sum := money.Money{}
	for i, tg := range targets {
		id, err := requiredID(tg.id, tg.field)
		if err != nil {
			return err
		}

		a, err := svc.Account(ctx, booksID, id)
		if err != nil {
			return err
		}

		amount := p.amount
		if len(in.Splits) > 0 {
			if amount, err = tool.ParsePositive(
				"splits["+strconv.Itoa(i)+"].amount",
				tg.amount,
				unit,
			); err != nil {
				return err
			}
		}

		if i == 0 {
			sum = amount
		} else if sum, err = sum.Add(amount); err != nil {
			return err
		}

		p.dests = append(p.dests, destination{account: a, amount: amount})
	}

	if len(in.Splits) > 0 && sum.Amount() != p.amount.Amount() {
		return tool.InvalidArgument("splits", "must add up to amount")
	}

	return nil
}

func planRecordKind(
	ctx context.Context,
	svc *app.Service,
	in recordTransactionIn,
	p *recordPlan,
) error {
	to := p.dests[0].account
	switch {
	case in.Installments != 0:
		if in.Installments < 2 || in.Installments > 48 {
			return tool.InvalidArgument("installments", "must be between 2 and 48")
		}

		if p.from.Kind != domain.KindCreditCard {
			return tool.InvalidArgument(
				"installments",
				"needs a credit card account in from_account_id",
			)
		}
	case in.OriginalAmount != "":
		return planForeignPurchase(ctx, svc, in, p)
	case in.ToAmount != "" || to.Instrument != p.from.Instrument:
		return planExchangeAmount(ctx, svc, in, to, p)
	}

	return nil
}

func planForeignPurchase(
	ctx context.Context,
	svc *app.Service,
	in recordTransactionIn,
	p *recordPlan,
) error {
	for field, v := range map[string]string{"original_currency": in.OriginalCurrency, "exchange_rate": in.ExchangeRate} {
		if v == "" {
			return tool.InvalidArgument(field, "is required with original_amount")
		}
	}

	ounit, err := svc.AmountOf(ctx, 0, money.Currency(in.OriginalCurrency))
	if err != nil {
		return tool.InvalidArgument("original_currency", "is not a known currency")
	}

	if p.original, err = tool.ParsePositive(
		"original_amount",
		in.OriginalAmount,
		ounit,
	); err != nil {
		return err
	}

	if p.rate, err = money.ParseRate(in.ExchangeRate); err != nil {
		return tool.InvalidArgument(
			"exchange_rate",
			"must be a positive decimal with at most 12 decimals",
		)
	}

	p.foreign = true

	return nil
}

func planExchangeAmount(
	ctx context.Context,
	svc *app.Service,
	in recordTransactionIn,
	to domain.Account,
	p *recordPlan,
) error {
	if in.ToAmount == "" {
		return tool.InvalidArgument(
			"to_amount",
			"is required when the accounts have different currencies",
		)
	}

	tunit, err := svc.AmountOf(ctx, 0, to.Instrument)
	if err != nil {
		return err
	}

	if p.toAmount, err = tool.ParsePositive("to_amount", in.ToAmount, tunit); err != nil {
		return err
	}

	p.exchange = true

	return nil
}

// planExchangeFee reads fee and fee_category_id, which only an exchange takes.
func planExchangeFee(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordTransactionIn,
	p *recordPlan,
) error {
	feeID, err := optionalID(in.FeeCategoryID, "fee_category_id")
	if err != nil {
		return err
	}

	if in.Fee == "" && feeID == uuid.Nil {
		return nil
	}

	switch {
	case !p.exchange:
		return tool.InvalidArgument(
			"fee",
			"is used only by an exchange between accounts in two currencies",
		)
	case in.Fee == "":
		return tool.InvalidArgument("fee", "is required with fee_category_id")
	}

	settings, err := svc.Settings(ctx, booksID)
	if err != nil {
		return err
	}

	unit, err := svc.AmountOf(ctx, 0, settings.BaseCurrency)
	if err != nil {
		return err
	}

	fee, err := tool.ParsePositive("fee", in.Fee, unit)
	if err != nil {
		return err
	}

	p.fee, p.feeID = &fee, feeID

	return nil
}
