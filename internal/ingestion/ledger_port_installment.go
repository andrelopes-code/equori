package ingestion

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification"
	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

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
