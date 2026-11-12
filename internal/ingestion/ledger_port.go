package ingestion

import (
	"context"
	"errors"
	"fmt"
	"time"

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

func (p ledgerPort) PairLine(
	ctx context.Context,
	booksID int64,
	txID, accountID, recordID uuid.UUID,
) (int, error) {
	version, err := p.l.PairImported(ctx, booksID, txID, accountID, recordID)

	return version, p.translate(err)
}

func (p ledgerPort) UnpairLine(
	ctx context.Context,
	booksID int64,
	txID, recordID uuid.UUID,
	version int,
) error {
	return p.translate(p.l.UnpairImported(ctx, booksID, txID, recordID, version))
}

func (p ledgerPort) GroupableTransactions(
	ctx context.Context,
	booksID int64,
	txIDs []uuid.UUID,
) ([]uuid.UUID, error) {
	ids, err := p.l.GroupableTransactions(ctx, booksID, txIDs)

	return ids, p.translate(err)
}

func (p ledgerPort) ConfirmGroup(
	ctx context.Context,
	booksID int64,
	txID, accountID uuid.UUID,
	parts []app.GroupPart,
) error {
	out := make([]ledger.GroupPart, len(parts))
	for i, part := range parts {
		out[i] = ledger.GroupPart(part)
	}

	return p.translate(p.l.ConfirmGroup(ctx, booksID, txID, accountID, out))
}

func (p ledgerPort) ConfirmLine(
	ctx context.Context,
	booksID int64,
	txID, accountID uuid.UUID,
	amount int64,
	date time.Time,
) error {
	return p.translate(p.l.ConfirmLine(ctx, booksID, txID, accountID, amount, date))
}

func (p ledgerPort) MoveReconciledDate(
	ctx context.Context,
	booksID int64,
	txID, accountID uuid.UUID,
	date time.Time,
) error {
	return p.translate(p.l.MoveReconciledDate(ctx, booksID, txID, accountID, date))
}

func (p ledgerPort) UnlinkedPostings(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from, to time.Time,
) ([]domain.LedgerPosting, error) {
	ps, err := p.l.UnlinkedPostings(ctx, booksID, accountID, from, to)

	out := make([]domain.LedgerPosting, len(ps))
	for i, x := range ps {
		out[i] = domain.LedgerPosting{
			TransactionID: x.TransactionID,
			Date:          x.Date,
			Amount:        x.Amount,
			PayeeID:       x.PayeeID,
			Description:   x.Description,
		}
	}

	return out, p.translate(err)
}

func (p ledgerPort) UnconfirmedPostings(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from, to time.Time,
) ([]domain.LedgerPosting, error) {
	ps, err := p.l.UnconfirmedPostings(ctx, booksID, accountID, from, to)

	out := make([]domain.LedgerPosting, len(ps))
	for i, x := range ps {
		out[i] = domain.LedgerPosting{
			TransactionID: x.TransactionID, Date: x.Date, Amount: x.Amount, PayeeID: x.PayeeID,
			Description: x.Description, StatementID: x.StatementID,
		}
	}

	return out, p.translate(err)
}

func (p ledgerPort) ClearMatched(
	ctx context.Context,
	booksID int64,
	ms []app.Match,
) ([]int, error) {
	matches := make([]ledger.Match, len(ms))
	for i, m := range ms {
		matches[i] = ledger.Match{
			RecordID:      m.RecordID,
			TransactionID: m.TransactionID,
			AccountID:     m.AccountID,
			KeepPending:   m.Pending,
		}
	}

	conflicts, err := p.l.ClearMatchedBatch(ctx, booksID, matches)

	return conflicts, p.translate(err)
}

func (p ledgerPort) AssertBalance(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	b domain.Balance,
	c money.Currency,
) error {
	return p.assert(ctx, booksID, accountID, b, c, p.l.AssertBalance)
}

func (p ledgerPort) AssertSyncedBalance(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	b domain.Balance,
	c money.Currency,
) error {
	return p.assert(ctx, booksID, accountID, b, c, p.l.AssertSyncedBalance)
}

func (p ledgerPort) AssertSyncedReserve(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	b domain.Balance,
	c money.Currency,
) error {
	return p.assert(ctx, booksID, accountID, b, c, p.l.AssertSyncedReserve)
}

type assertFunc func(ctx context.Context, booksID int64, accountID uuid.UUID, date time.Time, amount money.Money) error

func (p ledgerPort) assert(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	b domain.Balance,
	c money.Currency,
	assert assertFunc,
) error {
	amount, err := money.New(b.Amount, c)
	if err != nil {
		return err
	}

	err = assert(ctx, booksID, accountID, b.Date, amount)
	if errors.Is(err, ledger.ErrAlreadyReconciled) || errors.Is(err, ledger.ErrValidation) {
		return fmt.Errorf("%w: %w", app.ErrBalanceRejected, err)
	}

	return p.translate(err)
}

func (p ledgerPort) UpdateImportedPosting(
	ctx context.Context,
	booksID int64,
	recordID uuid.UUID,
	pending bool,
	dueDate *time.Time,
	kind string,
) (bool, error) {
	changed, err := p.l.UpdateImportedPosting(
		ctx,
		booksID,
		recordID,
		ledger.ImportedUpdate{Pending: pending, DueDate: dueDate, Kind: kind},
	)

	return changed, p.translate(err)
}

func (p ledgerPort) RecordInstallment(
	ctx context.Context,
	booksID int64,
	l app.InstallmentLine,
) (uuid.UUID, uuid.UUID, error) {
	posting, err := p.posting(l.Line)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}

	decisions, err := p.c.DecideImport(
		ctx,
		booksID,
		[]classification.ImportLine{importLine(posting, l.Line)},
	)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}

	var total *money.Money
	if t := l.Installment.Total; t != nil {
		m, err := money.New(*t, l.Line.Currency)
		if err != nil {
			return uuid.Nil, uuid.Nil, err
		}

		total = &m
	}

	txID, planID, err := p.l.RecordImportedInstallment(ctx, booksID, ledger.ImportedInstallment{
		RecordID:      l.RecordID,
		CardAccountID: posting.AccountID,
		PurchaseDate:  l.Installment.PurchaseDate,
		LineDate:      posting.Date,
		DueDate:       l.Line.DueDate,
		Description:   posting.Description,
		Number:        l.Installment.Number,
		Count:         l.Installment.Count,
		Amount:        posting.Amount.Neg(),
		Total:         total,
		Decision:      decisions[0],
	})

	return txID, planID, p.installmentError(err)
}

func (p ledgerPort) LinkInstallment(
	ctx context.Context,
	booksID int64,
	recordID, planID uuid.UUID,
	number int,
	l app.Line,
) (uuid.UUID, error) {
	posting, err := p.posting(l)
	if err != nil {
		return uuid.Nil, err
	}

	txID, err := p.l.LinkInstallment(
		ctx,
		booksID,
		recordID,
		planID,
		number,
		ledger.InstallmentConfirmation{
			Amount: posting.Amount.Neg(), DueDate: l.DueDate, Pending: l.Pending,
		},
	)

	return txID, p.installmentError(err)
}

func (p ledgerPort) installmentError(err error) error {
	for _, refused := range []error{ledger.ErrInstallmentUnavailable, ledger.ErrAlreadyMatched, ledger.ErrValidation} {
		if errors.Is(err, refused) {
			return fmt.Errorf("%w: %w", app.ErrInstallmentRefused, err)
		}
	}

	return p.translate(err)
}

func (p ledgerPort) RecordStatementFacts(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	b domain.Bill,
	c money.Currency,
) error {
	total, err := money.New(b.Total, c)
	if err != nil {
		return err
	}

	f := ledger.StatementFacts{Closing: b.Closing, Due: b.Due, Total: total}
	if b.Minimum != nil {
		minimum, err := money.New(*b.Minimum, c)
		if err != nil {
			return err
		}

		f.Minimum = &minimum
	}

	return p.translate(p.l.RecordStatementFacts(ctx, booksID, accountID, f))
}

func (p ledgerPort) RecordCardOpening(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	b domain.Bill,
	c money.Currency,
) error {
	total, err := money.New(b.Total, c)
	if err != nil {
		return err
	}

	return p.translate(p.l.RecordCardOpening(ctx, booksID, accountID, b.Due, total))
}

func (p ledgerPort) SettleReportedStatements(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) error {
	return p.translate(p.l.SettleReportedStatements(ctx, booksID, accountID))
}

func (p ledgerPort) ReleaseRecord(ctx context.Context, booksID int64, recordID uuid.UUID) error {
	return p.translate(p.l.ReleaseRecord(ctx, booksID, recordID))
}
