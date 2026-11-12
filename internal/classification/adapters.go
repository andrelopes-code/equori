package classification

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/classification/domain"
	"github.com/andrelopes-code/equori/internal/ledger"
)

type ledgerPort struct{ l *ledger.Module }

func (p ledgerPort) AccountFacts(ctx context.Context, booksID int64) ([]app.Account, error) {
	facts, err := p.l.AccountFacts(ctx, booksID)

	out := make([]app.Account, len(facts))
	for i, a := range facts {
		out[i] = app.Account{
			ID: a.ID, Class: a.Class, Kind: a.Kind, SystemRole: a.SystemRole,
			Instrument: a.Instrument, OpenedOn: a.OpenedOn, ClosedOn: a.ClosedOn,
		}
	}

	return out, err
}

func (p ledgerPort) TransactionFacts(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
) ([]app.TransactionFacts, error) {
	facts, err := p.l.TransactionFacts(ctx, booksID, ids)

	out := make([]app.TransactionFacts, len(facts))
	for i, f := range facts {
		out[i] = app.TransactionFacts{
			ID:             f.ID,
			Version:        f.Version,
			Date:           f.Date,
			Description:    f.Description,
			RawDescription: f.RawDescription,
			PayeeID:        f.PayeeID,
			Origin:         f.Origin,
			Voided:         f.Voided,
			CategoryState:  f.CategoryState,
			Postings:       make([]app.FactPosting, len(f.Postings)),
		}
		for j, x := range f.Postings {
			out[i].Postings[j] = app.FactPosting{
				AccountID:   x.AccountID,
				Class:       x.Class,
				Kind:        x.Kind,
				SystemRole:  x.SystemRole,
				Amount:      x.Amount,
				Installment: x.Installment,
			}
		}
	}

	return out, err
}

func (p ledgerPort) LatestPayeeCategories(
	ctx context.Context,
	booksID int64,
	payees []uuid.UUID,
) (map[domain.HistoryKey]uuid.UUID, error) {
	latest, err := p.l.LatestPayeeCategories(ctx, booksID, payees)

	out := make(map[domain.HistoryKey]uuid.UUID, len(latest))
	for k, v := range latest {
		out[domain.HistoryKey{PayeeID: k.PayeeID, Class: k.Class}] = v
	}

	return out, err
}

func (p ledgerPort) Categorize(
	ctx context.Context,
	booksID int64,
	cs []app.Categorization,
) ([]error, error) {
	items := make([]ledger.Categorization, len(cs))
	for i, c := range cs {
		items[i] = ledger.Categorization{
			TransactionID:   c.TransactionID,
			ExpectedVersion: c.ExpectedVersion,
			PayeeID:         c.PayeeID,
			AddTags:         c.AddTags,
			Cause:           ledger.Cause{Method: c.Method, RuleID: c.RuleID},
		}
		if c.Parts != nil {
			items[i].Parts = make([]ledger.CategoryPart, len(c.Parts))
			for j, a := range c.Parts {
				items[i].Parts[j] = ledger.CategoryPart{AccountID: a.CategoryID, Amount: a.Amount}
			}
		}
	}

	return p.l.Categorize(ctx, booksID, items)
}

func (p ledgerPort) Transfer(
	ctx context.Context,
	booksID int64,
	t app.TransferRequest,
) (bool, error) {
	_, err := p.l.Transfer(ctx, booksID, ledger.TransferRequest{
		TransactionID: t.TransactionID, ExpectedVersion: t.ExpectedVersion, AccountID: t.AccountID,
		Cause: ledger.Cause{Method: app.MethodRule, RuleID: t.RuleID},
	})
	for _, refused := range []error{
		ledger.ErrNotFound, ledger.ErrValidation, ledger.ErrVersionConflict, ledger.ErrVoided,
		ledger.ErrReconciled, ledger.ErrNotCategorizable, ledger.ErrPairingAmbiguous,
	} {
		if errors.Is(err, refused) {
			return false, nil
		}
	}

	return err == nil, err
}

func (p ledgerPort) Today(ctx context.Context) time.Time { return p.l.Today(ctx) }

func (p ledgerPort) MissingPayees(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
) ([]uuid.UUID, error) {
	return p.l.MissingPayees(ctx, booksID, ids)
}
