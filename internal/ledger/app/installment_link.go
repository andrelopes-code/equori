package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// InstallmentConfirmation is what an aggregator line reports about the installment it
// confirms (A90).
type InstallmentConfirmation struct {
	Amount  money.Money // one installment, positive
	DueDate *time.Time  // the line's bill; nil keeps the installment's statement
	Pending bool        // the institution has not billed the line yet
}

// LinkInstallment links a line to installment number of a plan and returns its transaction.
// The line sets the installment's amount and, with a bill, its statement; later installments
// no line confirms follow it month by month (A90). ErrInstallmentUnavailable when the
// installment is gone, its purchase was reversed, or a change would touch a reconciled
// posting; ErrAlreadyMatched when another record confirms it. Linking the same record again
// is a no-op.
func (s *Service) LinkInstallment(
	ctx context.Context,
	booksID int64,
	recordID, planID uuid.UUID,
	number int,
	c InstallmentConfirmation,
) (uuid.UUID, error) {
	var txID uuid.UUID
	err := s.repo.InTx(ctx, func(r Repository) error {
		in, err := r.LockPlanInstallment(ctx, booksID, planID, number)
		switch {
		case errors.Is(err, ErrNotFound):
			return ErrInstallmentUnavailable
		case err != nil:
			return err
		case in.Reversed:
			return ErrInstallmentUnavailable
		case in.RecordID == recordID:
			txID = in.TransactionID
			return nil
		case in.RecordID != uuid.Nil:
			return ErrAlreadyMatched
		}

		txID = in.TransactionID

		return s.confirmInstallment(ctx, r, booksID, in, recordID, number, c)
	})

	return txID, err
}

// confirmInstallment writes what the line reports on installment number: the record link,
// and a new version of the purchase when the amount or the statement differs.
func (s *Service) confirmInstallment(
	ctx context.Context,
	r Repository,
	booksID int64,
	in PlanInstallmentState,
	recordID uuid.UUID,
	number int,
	c InstallmentConfirmation,
) error {
	prev, err := r.LockTransaction(ctx, booksID, in.TransactionID)
	if err != nil {
		return err
	}

	k := slices.IndexFunc(
		prev.Postings,
		func(p domain.Posting) bool { return p.ID == in.PostingID },
	)
	if k < 0 {
		return ErrInstallmentUnavailable
	}

	target := prev.Postings[k].Statement
	if c.DueDate != nil {
		ref, err := s.statementDue(ctx, r, booksID, prev.Postings[k].AccountID, *c.DueDate)
		if err != nil {
			return err
		}

		target = &ref
	}

	status := prev.Postings[k].Status
	if c.Pending {
		status = domain.StatusPending
	}

	if -in.Amount == c.Amount.Amount() && target != nil && prev.Postings[k].Statement != nil &&
		*target == *prev.Postings[k].Statement {
		if err := r.LinkExternalRecord(ctx, booksID, in.PostingID, recordID); err != nil {
			return err
		}

		if status == prev.Postings[k].Status {
			return nil
		}

		return r.SettleImportedPosting(ctx, booksID, in.PostingID, status, uuid.Nil)
	}

	return s.rewriteInstallment(
		ctx,
		r,
		booksID,
		prev,
		k,
		recordID,
		number,
		c.Amount,
		*target,
		status,
	)
}

const reasonConfirmed = "installment confirmed"

// withConfirmedInstallment returns the next version of the purchase: posting k confirmed by
// the record with amount and statement ref, the later unconfirmed installments of its plan on
// ref's following months, and the first category posting taking the difference of the total.
func withConfirmedInstallment(
	prev domain.Transaction,
	k int,
	recordID uuid.UUID,
	number int,
	amount money.Money,
	ref domain.ReferenceMonth,
	status domain.PostingStatus,
) (domain.Transaction, error) {
	next := prev
	next.Postings = slices.Clone(prev.Postings)
	next.Version++
	plan := next.Postings[k].Installment.PlanID

	delta := next.Postings[k].Amount.Amount() + amount.Amount() // the card side grows by −delta
	for i := range next.Postings {
		p := &next.Postings[i]

		moved := i == k
		if inst := p.Installment; !moved && inst != nil && inst.PlanID == plan &&
			inst.Number > number &&
			p.ExternalRecordID == uuid.Nil {
			later := ref.Add(inst.Number - number)
			moved = p.Statement == nil || *p.Statement != later
			p.Statement = &later
		}

		if i == k {
			p.Amount, p.Weight, p.ExternalRecordID, p.Statement, p.Status = amount.Neg(), money.Money{}, recordID, &ref, status
		}

		if !moved {
			continue
		}

		if p.Status == domain.StatusReconciled {
			return domain.Transaction{}, ErrInstallmentUnavailable
		}

		p.ID, p.StatementID = uuid.Nil, uuid.Nil
	}

	if delta == 0 {
		return next, nil
	}

	if err := absorbInstallmentDelta(next.Postings, delta); err != nil {
		return domain.Transaction{}, err
	}

	return next, nil
}
