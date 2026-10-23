package toolapi

import (
	"context"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type recordTransactionSplitsItem struct {
	ToAccountID string `json:"to_account_id" jsonschema:"expense category or account receiving this part"`
	Amount      string `json:"amount" jsonschema:"positive decimal amount of this part"`
}

type recordTransactionIn struct {
	Date             tool.Date                     `json:"date" jsonschema:"transaction date"`
	Description      string                        `json:"description" jsonschema:"short description, such as the merchant or the purpose"`
	Amount           string                        `json:"amount" jsonschema:"positive decimal amount in the currency of from_account_id, such as 125.90"`
	FromAccountID    string                        `json:"from_account_id" jsonschema:"account or category the money leaves: a checking, cash or card account for a purchase, an income category for income"`
	ToAccountID      string                        `json:"to_account_id,omitzero" jsonschema:"account or category the money reaches: an expense category for a purchase, an asset account for income or a transfer; absent when splits is set"`
	Splits           []recordTransactionSplitsItem `json:"splits,omitzero" jsonschema:"several destinations whose amounts add up to amount"`
	PayeeID          string                        `json:"payee_id,omitzero" jsonschema:"payee from list_payees_and_tags"`
	Tags             []string                      `json:"tags,omitzero" jsonschema:"tags of the transaction"`
	Installments     int                           `json:"installments,omitzero" jsonschema:"number of installments, 2 to 48, for a purchase on a credit card account"`
	OriginalAmount   string                        `json:"original_amount,omitzero" jsonschema:"for a foreign purchase on a card: positive amount charged in original_currency"`
	OriginalCurrency string                        `json:"original_currency,omitzero" jsonschema:"for a foreign purchase on a card: ISO 4217 code of the charged currency"`
	ExchangeRate     string                        `json:"exchange_rate,omitzero" jsonschema:"for a foreign purchase: decimal rate from original_currency to the card's currency, such as 5.4830"`
	ToAmount         string                        `json:"to_amount,omitzero" jsonschema:"for an exchange between accounts in two currencies: positive amount received in the currency of to_account_id"`
}

type recordTransactionOut struct {
	TransactionID string    `json:"transaction_id"`
	Date          tool.Date `json:"date"`
	Description   string    `json:"description"`
}

type destination struct {
	account domain.Account
	amount  money.Money
}

// recordPlan is a record_transaction request resolved against the user's accounts.
type recordPlan struct {
	from     domain.Account
	amount   money.Money
	dests    []destination
	payeeID  uuid.UUID
	toAmount money.Money // set for an exchange
	exchange bool
	original money.Money // set for a foreign purchase
	rate     money.Rate
	foreign  bool
}

func recordTransaction(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "record_transaction",
		Description: "Proposes a new transaction: money moves from one account or category to another. " +
			"A purchase moves from a checking, cash or card account to an expense category; income moves from an income category to an asset account; a transfer moves between two own accounts. " +
			"With installments on a card it records an installment purchase; with original_amount on a card it records a foreign purchase; with to_amount between two currencies it records an exchange. " +
			"Use it when the user asks to record, add or log a transaction. " +
			"Do not use it to change an existing transaction: change_transaction does. " +
			"The user confirms the proposal before anything is recorded.",
		Effect: tool.Write,
	}, func(ctx context.Context, userID int64, in recordTransactionIn) (tool.Preview, error) {
		p, err := planRecord(ctx, svc, userID, in)
		if err != nil {
			return tool.Preview{}, err
		}
		pv := tool.Preview{Action: "record_transaction", Changes: []tool.Change{
			{Field: "date", After: tool.DateValue(in.Date.Time)},
			{Field: "description", After: tool.TextValue(in.Description)},
			{Field: "amount", After: tool.MoneyValue(p.amount)},
			{Field: "account", After: tool.TextValue(p.from.Name)},
		}}
		for _, d := range p.dests {
			field := "account"
			if d.account.IsCategory() {
				field = "category"
			}
			pv.Changes = append(pv.Changes, tool.Change{Field: field, After: tool.TextValue(d.account.Name)})
		}
		if p.payeeID != uuid.Nil {
			names, err := svc.PayeeNames(ctx, userID, []uuid.UUID{p.payeeID})
			if err != nil {
				return tool.Preview{}, err
			}
			pv.Changes = append(pv.Changes, tool.Change{Field: "payee", After: tool.TextValue(names[p.payeeID])})
		}
		if len(in.Tags) > 0 {
			pv.Changes = append(pv.Changes, tool.Change{Field: "tags", After: tool.TextValue(strings.Join(in.Tags, ", "))})
		}
		if in.Installments > 0 {
			pv.Changes = append(pv.Changes, tool.Change{Field: "installments", After: tool.TextValue(strconv.Itoa(in.Installments))})
		}
		if p.foreign {
			pv.Changes = append(pv.Changes, tool.Change{Field: "rate", After: tool.TextValue(p.rate.String())}, tool.Change{Field: "amount", After: tool.MoneyValue(p.original)})
		}
		if p.exchange {
			pv.Changes = append(pv.Changes, tool.Change{Field: "amount", After: tool.MoneyValue(p.toAmount)})
		}
		return pv, nil
	}, func(ctx context.Context, userID int64, in recordTransactionIn) (recordTransactionOut, error) {
		p, err := planRecord(ctx, svc, userID, in)
		if err != nil {
			return recordTransactionOut{}, err
		}
		var t domain.Transaction
		switch {
		case in.Installments > 0:
			splits := make([]domain.Posting, len(p.dests))
			for i, d := range p.dests {
				splits[i] = domain.Posting{AccountID: d.account.ID, Amount: d.amount}
			}
			t, _, err = svc.InstallmentPurchase(ctx, userID, app.InstallmentPurchaseInput{
				CardAccountID: p.from.ID, Date: in.Date.Time, Description: in.Description, PayeeID: p.payeeID, Tags: in.Tags,
				Splits: splits, Count: in.Installments,
			})
		case p.foreign:
			t, err = svc.RecordForeignPurchase(ctx, userID, app.ForeignPurchase{
				AccountID: p.from.ID, CategoryID: p.dests[0].account.ID, PayeeID: p.payeeID,
				Date: in.Date.Time, Description: in.Description, Original: p.original, Rate: p.rate,
			})
		case p.exchange:
			t, err = svc.Exchange(ctx, userID, app.Exchange{
				FromAccountID: p.from.ID, ToAccountID: p.dests[0].account.ID, Date: in.Date.Time, Description: in.Description,
				FromAmount: p.amount, ToAmount: p.toAmount,
			})
		default:
			postings := []domain.Posting{{AccountID: p.from.ID, Amount: p.amount.Neg()}}
			for _, d := range p.dests {
				postings = append(postings, domain.Posting{AccountID: d.account.ID, Amount: d.amount})
			}
			t, err = svc.RecordTransaction(ctx, userID, domain.Transaction{
				Date: in.Date.Time, Description: in.Description, PayeeID: p.payeeID, Tags: in.Tags, Postings: postings, Origin: domain.OriginManual,
			})
		}
		if err != nil {
			return recordTransactionOut{}, err
		}
		return recordTransactionOut{TransactionID: t.ID.String(), Date: tool.DateOf(t.Date), Description: t.Description}, nil
	})
}

func planRecord(ctx context.Context, svc *app.Service, userID int64, in recordTransactionIn) (recordPlan, error) {
	var p recordPlan
	fromID, err := requiredID(in.FromAccountID, "from_account_id")
	if err != nil {
		return p, err
	}
	if p.from, err = svc.Account(ctx, userID, fromID); err != nil {
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

	type target struct {
		field, id, amount string
	}
	var targets []target
	switch {
	case len(in.Splits) > 0 && in.ToAccountID != "":
		return p, tool.InvalidArgument("splits", "cannot be combined with to_account_id")
	case len(in.Splits) > 0:
		for i, s := range in.Splits {
			targets = append(targets, target{"splits[" + strconv.Itoa(i) + "].to_account_id", s.ToAccountID, s.Amount})
		}
	case in.ToAccountID == "":
		return p, tool.InvalidArgument("to_account_id", "is required without splits")
	default:
		targets = []target{{"to_account_id", in.ToAccountID, in.Amount}}
	}
	sum := money.Money{}
	for i, tg := range targets {
		id, err := requiredID(tg.id, tg.field)
		if err != nil {
			return p, err
		}
		a, err := svc.Account(ctx, userID, id)
		if err != nil {
			return p, err
		}
		amount := p.amount
		if len(in.Splits) > 0 {
			if amount, err = tool.ParsePositive("splits["+strconv.Itoa(i)+"].amount", tg.amount, unit); err != nil {
				return p, err
			}
		}
		if i == 0 {
			sum = amount
		} else if sum, err = sum.Add(amount); err != nil {
			return p, err
		}
		p.dests = append(p.dests, destination{account: a, amount: amount})
	}
	if len(in.Splits) > 0 && sum.Amount() != p.amount.Amount() {
		return p, tool.InvalidArgument("splits", "must add up to amount")
	}

	to := p.dests[0].account
	switch {
	case in.Installments != 0:
		if in.Installments < 2 || in.Installments > 48 {
			return p, tool.InvalidArgument("installments", "must be between 2 and 48")
		}
		if p.from.Kind != domain.KindCreditCard {
			return p, tool.InvalidArgument("installments", "needs a credit card account in from_account_id")
		}
	case in.OriginalAmount != "":
		for field, v := range map[string]string{"original_currency": in.OriginalCurrency, "exchange_rate": in.ExchangeRate} {
			if v == "" {
				return p, tool.InvalidArgument(field, "is required with original_amount")
			}
		}
		ounit, err := svc.AmountOf(ctx, 0, money.Currency(in.OriginalCurrency))
		if err != nil {
			return p, tool.InvalidArgument("original_currency", "is not a known currency")
		}
		if p.original, err = tool.ParsePositive("original_amount", in.OriginalAmount, ounit); err != nil {
			return p, err
		}
		if p.rate, err = money.ParseRate(in.ExchangeRate); err != nil {
			return p, tool.InvalidArgument("exchange_rate", "must be a positive decimal with at most 12 decimals")
		}
		p.foreign = true
	case in.ToAmount != "" || to.Instrument != p.from.Instrument:
		if in.ToAmount == "" {
			return p, tool.InvalidArgument("to_amount", "is required when the accounts have different currencies")
		}
		tunit, err := svc.AmountOf(ctx, 0, to.Instrument)
		if err != nil {
			return p, err
		}
		if p.toAmount, err = tool.ParsePositive("to_amount", in.ToAmount, tunit); err != nil {
			return p, err
		}
		p.exchange = true
	}
	return p, nil
}
