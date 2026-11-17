package toolapi

import (
	"context"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type recordTransactionSplitsItem struct {
	ToAccountID string `json:"to_account_id" jsonschema:"expense category or account receiving this part"`
	Amount      string `json:"amount"        jsonschema:"positive decimal amount of this part"`
}

type recordTransactionIn struct {
	Date             tool.Date                     `json:"date"                       jsonschema:"transaction date"`
	Description      string                        `json:"description"                jsonschema:"short description, such as the merchant or the purpose"`
	Amount           string                        `json:"amount"                     jsonschema:"positive decimal amount in the currency of from_account_id, such as 125.90"`
	FromAccountID    string                        `json:"from_account_id"            jsonschema:"account or category the money leaves: a checking, cash or card account for a purchase, an income category for income"`
	ToAccountID      string                        `json:"to_account_id,omitzero"     jsonschema:"account or category the money reaches: an expense category for a purchase, an asset account for income or a transfer; absent when splits is set"`
	Splits           []recordTransactionSplitsItem `json:"splits,omitzero"            jsonschema:"several destinations whose amounts add up to amount"`
	PayeeID          string                        `json:"payee_id,omitzero"          jsonschema:"payee from list_payees_and_tags"`
	Tags             []string                      `json:"tags,omitzero"              jsonschema:"tags of the transaction"`
	Installments     int                           `json:"installments,omitzero"      jsonschema:"number of installments, 2 to 48, for a purchase on a credit card account"`
	OriginalAmount   string                        `json:"original_amount,omitzero"   jsonschema:"for a foreign purchase on a card: positive amount charged in original_currency"`
	OriginalCurrency string                        `json:"original_currency,omitzero" jsonschema:"for a foreign purchase on a card: ISO 4217 code of the charged currency"`
	ExchangeRate     string                        `json:"exchange_rate,omitzero"     jsonschema:"for a foreign purchase: decimal rate from original_currency to the card's currency, such as 5.4830"`
	ToAmount         string                        `json:"to_amount,omitzero"         jsonschema:"for an exchange between accounts in two currencies: positive amount received in the currency of to_account_id"`
	Fee              string                        `json:"fee,omitzero"               jsonschema:"for an exchange: positive fee in the base currency"`
	FeeCategoryID    string                        `json:"fee_category_id,omitzero"   jsonschema:"for an exchange: expense category of the fee; the fees account when absent"`
}

type recordTransactionOut struct {
	TransactionID string    `json:"transaction_id"`
	Date          tool.Date `json:"date"`
	Description   string    `json:"description"`
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
	}, func(ctx context.Context, booksID int64, in recordTransactionIn) (tool.Preview, error) {
		return previewRecord(ctx, svc, booksID, in)
	}, func(ctx context.Context, booksID int64, in recordTransactionIn) (recordTransactionOut, error) {
		return runRecord(ctx, svc, booksID, in)
	})
}

func previewRecord(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordTransactionIn,
) (tool.Preview, error) {
	p, err := planRecord(ctx, svc, booksID, in)
	if err != nil {
		return tool.Preview{}, err
	}

	pv := tool.Preview{Action: "record_transaction", Changes: recordMainChanges(in, p)}

	if p.payeeID != uuid.Nil {
		names, err := svc.PayeeNames(ctx, booksID, []uuid.UUID{p.payeeID})
		if err != nil {
			return tool.Preview{}, err
		}

		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "payee", After: tool.TextValue(names[p.payeeID])},
		)
	}

	pv.Changes = append(pv.Changes, recordOptionChanges(in, p)...)

	return pv, nil
}

func runRecord(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordTransactionIn,
) (recordTransactionOut, error) {
	p, err := planRecord(ctx, svc, booksID, in)
	if err != nil {
		return recordTransactionOut{}, err
	}

	t, err := recordByKind(ctx, svc, booksID, in, p)
	if err != nil {
		return recordTransactionOut{}, err
	}

	return recordTransactionOut{
		TransactionID: t.ID.String(),
		Date:          tool.DateOf(t.Date),
		Description:   t.Description,
	}, nil
}

func recordMainChanges(in recordTransactionIn, p recordPlan) []tool.Change {
	changes := []tool.Change{
		{Field: "date", After: tool.DateValue(in.Date.Time)},
		{Field: "description", After: tool.TextValue(in.Description)},
		{Field: "amount", After: tool.MoneyValue(p.amount)},
		{Field: "account", After: tool.TextValue(p.from.Name)},
	}
	for _, d := range p.dests {
		field := "account"
		if d.account.IsCategory() {
			field = "category"
		}

		changes = append(changes, tool.Change{Field: field, After: tool.TextValue(d.account.Name)})
	}

	return changes
}

func recordOptionChanges(in recordTransactionIn, p recordPlan) []tool.Change {
	var changes []tool.Change
	if len(in.Tags) > 0 {
		changes = append(
			changes,
			tool.Change{Field: "tags", After: tool.TextValue(strings.Join(in.Tags, ", "))},
		)
	}

	if in.Installments > 0 {
		changes = append(
			changes,
			tool.Change{
				Field: "installments",
				After: tool.TextValue(strconv.Itoa(in.Installments)),
			},
		)
	}

	if p.foreign {
		changes = append(
			changes,
			tool.Change{Field: "rate", After: tool.TextValue(p.rate.String())},
			tool.Change{Field: "amount", After: tool.MoneyValue(p.original)},
		)
	}

	if p.exchange {
		changes = append(changes, tool.Change{Field: "amount", After: tool.MoneyValue(p.toAmount)})
	}

	if p.fee != nil {
		changes = append(changes, tool.Change{Field: "amount", After: tool.MoneyValue(*p.fee)})
	}

	return changes
}

func recordByKind(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordTransactionIn,
	p recordPlan,
) (domain.Transaction, error) {
	var t domain.Transaction

	var err error
	switch {
	case in.Installments > 0:
		t, err = recordInstallments(ctx, svc, booksID, in, p)
	case p.foreign:
		t, err = svc.RecordForeignPurchase(ctx, booksID, app.ForeignPurchase{
			AccountID: p.from.ID, CategoryID: p.dests[0].account.ID, PayeeID: p.payeeID,
			Date: in.Date.Time, Description: in.Description, Original: p.original, Rate: p.rate,
		})
	case p.exchange && !p.categorized():
		t, err = svc.Exchange(ctx, booksID, app.Exchange{
			FromAccountID: p.from.ID,
			ToAccountID:   p.dests[0].account.ID,
			Date:          in.Date.Time,
			Description:   in.Description,
			FromAmount:    p.amount,
			ToAmount:      p.toAmount,
			Fee:           p.fee,
			FeeCategoryID: p.feeID,
		})
	default:
		t, err = recordPosted(ctx, svc, booksID, in, p)
	}

	return t, err
}

func recordPosted(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordTransactionIn,
	p recordPlan,
) (domain.Transaction, error) {
	postings, err := recordPostings(ctx, svc, booksID, in, p)
	if err != nil {
		return domain.Transaction{}, err
	}

	return svc.RecordTransaction(ctx, booksID, domain.Transaction{
		Date:        in.Date.Time,
		Description: in.Description,
		PayeeID:     p.payeeID,
		Tags:        in.Tags,
		Postings:    postings,
		Origin:      domain.OriginManual,
	})
}

func recordInstallments(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordTransactionIn,
	p recordPlan,
) (domain.Transaction, error) {
	splits := make([]domain.Posting, len(p.dests))
	for i, d := range p.dests {
		splits[i] = domain.Posting{AccountID: d.account.ID, Amount: d.amount}
	}

	t, _, err := svc.InstallmentPurchase(ctx, booksID, app.InstallmentPurchaseInput{
		CardAccountID: p.from.ID,
		Date:          in.Date.Time,
		Description:   in.Description,
		PayeeID:       p.payeeID,
		Tags:          in.Tags,
		Splits:        splits,
		Count:         in.Installments,
	})

	return t, err
}
