package planning

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/planning/internal/adapter/toolapi"
	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/textfold"
)

// RecurringProbe is a transaction not recorded yet, named as a preview names it.
type RecurringProbe struct {
	Payee, Description, Account string
	Date                        time.Time
	Amount                      string // decimal text of the preview
	Currency                    string
}

// RecurringFor returns the series the probe joins, encoded as find_recurring encodes one series.
// ok is false when the probe joins no qualifying series or names an unknown account, or when its
// amount does not parse.
func (m *Module) RecurringFor(ctx context.Context, booksID int64, p RecurringProbe) (json.RawMessage, bool, error) {
	accounts, payees, err := m.ledger.CaptureVocabulary(ctx, booksID)
	if err != nil {
		return nil, false, err
	}

	fact, ok := probeFact(p, accounts, payees)
	if !ok {
		return nil, false, nil
	}

	series, err := m.svc.Recurring(ctx, booksID, app.RecurringFilter{Probe: &fact})
	if err != nil || len(series) == 0 {
		return nil, false, err
	}

	tl := toolLedger{m.ledger}

	names, err := tl.Accounts(ctx, booksID)
	if err != nil {
		return nil, false, err
	}

	payeeNames, err := tl.PayeeNames(ctx, booksID)
	if err != nil {
		return nil, false, err
	}

	out, err := toolapi.EncodeSeries(series[0], payeeNames[series[0].PayeeID], names)

	return out, err == nil, err
}

// probeFact resolves the names of p into a detector fact; ok is false when the account is not an
// open balance account of the book or the amount or the key is unusable.
func probeFact(p RecurringProbe, accounts []ledger.CaptureAccount, payees []ledger.CapturePayee) (app.SeriesFact, bool) {
	var account ledger.CaptureAccount

	for _, a := range accounts {
		if a.ClosedOn == nil && textfold.String(a.Name) == textfold.String(p.Account) {
			account = a
			break
		}
	}

	unit, err := money.New(0, account.Instrument)
	if err != nil || account.ID == uuid.Nil || (p.Currency != "" && p.Currency != string(account.Instrument)) {
		return app.SeriesFact{}, false
	}

	amount, err := money.ParseDecimal(p.Amount, account.Instrument, unit.Scale())
	if err != nil || amount.Amount() <= 0 {
		return app.SeriesFact{}, false
	}

	fact := app.SeriesFact{AccountID: account.ID, Date: p.Date, Amount: amount.Amount(), Key: textfold.String(p.Description)}

	for _, py := range payees {
		if p.Payee != "" && textfold.String(py.Name) == textfold.String(p.Payee) {
			fact.PayeeID, fact.Key = py.ID, py.ID.String()
			break
		}
	}

	return fact, fact.Key != ""
}
