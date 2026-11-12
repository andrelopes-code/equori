package ingestion

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification"
	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ledgerPort adapts package ledger to the port app.Ledger, translating its errors.
// ledgerPort records lines in the ledger after Classification decides them (P5 amendment A19).
type ledgerPort struct {
	l *ledger.Module
	c *classification.Module
}

func (p ledgerPort) translate(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, ledger.ErrNotFound):
		return app.ErrNotFound
	case errors.Is(err, ledger.ErrAlreadyMatched):
		return app.ErrAlreadyMatched
	case errors.Is(err, ledger.ErrReconciled):
		return app.ErrReconciled
	case errors.Is(err, ledger.ErrNotRetypable):
		return app.ErrNotRetypable
	case errors.Is(err, ledger.ErrVoided):
		return app.ErrTransactionVoided
	case errors.Is(err, ledger.ErrNotGroupable):
		return app.ErrGroupChanged
	case errors.Is(err, ledger.ErrNotPairable):
		return app.ErrNotPairable
	case errors.Is(err, ledger.ErrNotUnpairable):
		return app.ErrNotUnpairable
	}

	return err
}

func (p ledgerPort) posting(l app.Line) (ledger.ImportedPosting, error) {
	amount, err := money.New(l.Amount, l.Currency)

	return ledger.ImportedPosting{
		AccountID:   l.AccountID,
		Date:        l.Date,
		Amount:      amount,
		Description: l.Description,
		Pending:     l.Pending,
		DueDate:     l.DueDate,
		Kind:        l.Kind,
	}, err
}

// importLine is a line as Classification decides it; aggregator lines carry Pluggy's category.
func importLine(posting ledger.ImportedPosting, l app.Line) classification.ImportLine {
	line := classification.ImportLine{
		AccountID:   posting.AccountID,
		Date:        posting.Date,
		Amount:      posting.Amount,
		Description: posting.Description,
	}
	if c := l.Category; c != nil {
		line.SourceCategory = &classification.LineCategory{
			Aggregator: c.Aggregator,
			ExternalID: c.ID,
			Name:       c.Name,
		}
	}

	return line
}

func (p ledgerPort) ImportTarget(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) (domain.ImportTarget, error) {
	t, err := p.l.ImportTarget(ctx, booksID, accountID)
	if errors.Is(err, ledger.ErrValidation) {
		return domain.ImportTarget{}, &domain.FieldError{
			Field:   "account_id",
			Message: "must be a balance account without sub-accounts",
		}
	}

	return domain.ImportTarget{Currency: t.Currency, Kind: t.Kind}, p.translate(err)
}

func (p ledgerPort) LinkedTransaction(
	ctx context.Context,
	booksID int64,
	recordID uuid.UUID,
) (uuid.UUID, bool, error) {
	id, imported, err := p.l.LinkedTransaction(ctx, booksID, recordID)
	return id, imported, p.translate(err)
}

func (p ledgerPort) RecordImported(
	ctx context.Context,
	booksID int64,
	lines []app.NewLine,
) ([]uuid.UUID, error) {
	recs := make([]ledger.ImportedRecord, len(lines))

	decide := make([]classification.ImportLine, len(lines))
	for i, l := range lines {
		posting, err := p.posting(l.Line)
		if err != nil {
			return nil, err
		}

		recs[i] = ledger.ImportedRecord{RecordID: l.RecordID, Posting: posting}
		decide[i] = importLine(posting, l.Line)
	}

	decisions, err := p.c.DecideImport(ctx, booksID, decide)
	if err != nil {
		return nil, err
	}

	for i := range recs {
		recs[i].Decision = decisions[i]
		if lines[i].Line.Unclassified {
			recs[i].Decision = nil
		}

		if to := lines[i].Line.TransferTo; to != nil {
			recs[i].Decision = &ledger.ImportDecision{
				TransferTo: *to,
				Cause:      ledger.Cause{Method: "source"},
			}
		}
	}

	ids, err := p.l.RecordImportedBatch(ctx, booksID, recs)
	if le, ok := errors.AsType[*ledger.LineError](err); ok {
		return nil, &app.RejectedLine{Index: le.Index, Reason: le.Err}
	}

	return ids, p.translate(err)
}

func (p ledgerPort) LinePayees(
	ctx context.Context,
	booksID int64,
	lines []app.Line,
) ([]uuid.UUID, error) {
	decide := make([]classification.ImportLine, len(lines))
	for i, l := range lines {
		posting, err := p.posting(l)
		if err != nil {
			return nil, err
		}

		decide[i] = importLine(posting, l)
	}

	decisions, err := p.c.DecideImport(ctx, booksID, decide)
	if err != nil {
		return nil, err
	}

	out := make([]uuid.UUID, len(lines))
	for i, d := range decisions {
		if d != nil {
			out[i] = d.PayeeID
		}
	}

	return out, nil
}

// RuleDecided leaves SourceCategory nil: no rule reads it, and deciding it would count its usage twice.
func (p ledgerPort) RuleDecided(
	ctx context.Context,
	booksID int64,
	lines []app.Line,
) ([]bool, error) {
	decide := make([]classification.ImportLine, len(lines))
	for i, l := range lines {
		posting, err := p.posting(l)
		if err != nil {
			return nil, err
		}

		decide[i] = importLine(posting, app.Line{})
	}

	decisions, err := p.c.DecideImport(ctx, booksID, decide)
	if err != nil {
		return nil, err
	}

	out := make([]bool, len(lines))
	for i, d := range decisions {
		out[i] = d != nil && d.Cause.Method == classification.MethodRule
	}

	return out, nil
}

func (p ledgerPort) Counterparts(
	ctx context.Context,
	booksID int64,
	l app.Line,
) ([]app.Counterpart, error) {
	amount, err := money.New(l.Amount, l.Currency)
	if err != nil {
		return nil, err
	}

	cps, err := p.l.Counterparts(
		ctx,
		booksID,
		ledger.CounterpartQuery{AccountID: l.AccountID, Amount: amount, Date: l.Date},
	)
	if err != nil {
		return nil, p.translate(err)
	}

	out := make([]app.Counterpart, len(cps))
	for i, cp := range cps {
		out[i] = app.Counterpart(cp)
	}

	return out, nil
}
