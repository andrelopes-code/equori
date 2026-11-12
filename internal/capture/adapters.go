package capture

import (
	"context"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/capture/app"
	"github.com/andrelopes-code/equori/internal/classification"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type ledgerPort struct{ l *ledger.Module }

func (p ledgerPort) Vocabulary(
	ctx context.Context,
	booksID int64,
) ([]app.Account, []app.Payee, error) {
	accounts, payees, err := p.l.CaptureVocabulary(ctx, booksID)
	if err != nil {
		return nil, nil, err
	}

	outAccounts := make([]app.Account, len(accounts))
	for i, a := range accounts {
		outAccounts[i] = app.Account{
			ID:            a.ID,
			ParentID:      a.ParentID,
			Name:          a.Name,
			Class:         a.Class,
			Kind:          a.Kind,
			SystemRole:    a.SystemRole,
			Instrument:    a.Instrument,
			Closed:        a.ClosedOn != nil,
			Institution:   a.Institution,
			CardsLastFour: a.CardsLastFour,
		}
	}

	outPayees := make([]app.Payee, len(payees))
	for i, x := range payees {
		outPayees[i] = app.Payee{ID: x.ID, Name: x.Name}
	}

	return outAccounts, outPayees, nil
}

func (p ledgerPort) BaseCurrency(ctx context.Context, booksID int64) (money.Currency, error) {
	return p.l.BaseCurrency(ctx, booksID)
}

func (p ledgerPort) Today(ctx context.Context) time.Time { return p.l.Today(ctx) }

// Transactions classes a transaction by its uncategorized posting; a voided one, or one with a
// category, has no class.
func (p ledgerPort) Transactions(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
) ([]app.Transaction, error) {
	facts, err := p.l.TransactionFacts(ctx, booksID, ids)
	if err != nil {
		return nil, err
	}

	out := make([]app.Transaction, len(facts))
	for i, f := range facts {
		out[i] = app.Transaction{ID: f.ID, Description: f.Description}
		if f.Voided || f.CategoryState != "uncategorized" {
			continue
		}

		for _, x := range f.Postings {
			if class, ok := strings.CutPrefix(x.SystemRole, "uncategorized_"); ok {
				out[i].Class = class
				break
			}
		}
	}

	return out, nil
}

type classifierPort struct{ c *classification.Module }

// Decide keeps a category only when the decision is one category; a split or a transfer is
// left to the classification of the recorded transaction (P5 A20).
func (p classifierPort) Decide(
	ctx context.Context,
	booksID int64,
	entries []app.Entry,
) ([]app.Decision, error) {
	lines := make([]classification.ManualLine, len(entries))
	for i, e := range entries {
		lines[i] = classification.ManualLine{
			AccountID:   e.AccountID,
			Date:        e.Date,
			Amount:      e.Amount,
			Description: e.Description,
			NamedPayee:  e.NamedPayee,
		}
	}

	decisions, err := p.c.DecideManual(ctx, booksID, lines)
	if err != nil {
		return nil, err
	}

	out := make([]app.Decision, len(decisions))
	for i, d := range decisions {
		if d == nil {
			continue
		}

		out[i] = app.Decision{PayeeID: d.PayeeID, Tags: slices.Clone(d.AddTags)}
		if len(d.Parts) == 1 && d.TransferTo == uuid.Nil {
			out[i].CategoryID, out[i].Method = d.Parts[0].AccountID, d.Cause.Method
		}
	}

	return out, nil
}
