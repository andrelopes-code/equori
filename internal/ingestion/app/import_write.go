package app

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

// create records the transactions of new lines. A line the ledger refuses fails a file
// import; in a sync it waits for review and the other lines are created.
func (s *Service) create(
	ctx context.Context,
	booksID int64,
	sync bool,
	creates []NewLine,
	created []*domain.ExternalRecord,
) error {
	for {
		ids, err := s.ledger.RecordImported(ctx, booksID, creates)

		rejected, ok := errors.AsType[*RejectedLine](err)
		switch {
		case ok && sync:
			created[rejected.Index].State = domain.StateNeedsReview
			creates, created = slices.Delete(
				creates,
				rejected.Index,
				rejected.Index+1,
			), slices.Delete(
				created,
				rejected.Index,
				rejected.Index+1,
			)

			continue
		case ok:
			rec := created[rejected.Index]

			return fileError(
				fmt.Sprintf(
					"line dated %s for %d: %v",
					rec.Date.Format(time.DateOnly),
					rec.Amount,
					rejected.Reason,
				),
			)
		case err != nil:
			return err
		}

		for i, rec := range created {
			rec.State, rec.TransactionID = domain.StateCreated, ids[i]
		}

		return nil
	}
}

// withFacts copies what an aggregator reports about a line onto its record.
func withFacts(rec *domain.ExternalRecord, r domain.NormalizedRecord) {
	rec.ExternalStatus, rec.DueDate, rec.Installment, rec.BalanceAfter, rec.Raw = domain.ExternalStatusOf(
		r,
	), r.DueDate, r.Installment, r.BalanceAfter, r.Raw
	rec.LineKind = r.Kind
	rec.ReportedAmount, rec.ReportedOn = r.Amount, r.Date

	if rec.InstitutionID == "" {
		rec.InstitutionID = r.InstitutionID
	}

	rec.CategoryID = ""
	if r.Category != nil {
		rec.CategoryID = r.Category.ID
	}
}

// update applies an aggregator's change to a stored line that the ledger recorded (P6 A36):
// a posted line clears its posting, a bill moves a card posting to the bill's statement.
// A reconciled posting and an amount change stay out of the ledger and are described on
// the record. reported is true when the line differs from the stored facts, changed when the
// ledger took the difference or the record's unapplied change text is new (P12 A147).
func (s *Service) update(
	ctx context.Context,
	sync bool,
	batchID uuid.UUID,
	rec *domain.ExternalRecord,
	r domain.NormalizedRecord,
) (reported, changed bool, err error) {
	if !sync || (rec.State != domain.StateMatched && rec.State != domain.StateCreated) {
		return false, false, nil
	}

	identified := rec.InstitutionID == "" && r.InstitutionID != ""

	settled := rec.ExternalStatus != domain.ExternalStatusOf(r) || !sameDate(rec.DueDate, r.DueDate)
	retype := r.Kind == domain.KindPayment && rec.LineKind != r.Kind

	moved := rec.ReportedAmount != r.Amount || !rec.ReportedOn.Equal(r.Date)
	if !settled && !retype && !moved && !identified {
		return false, false, nil
	}

	var notes []string

	applied := rec.LineKind
	if settled || retype {
		note, posted, kept, err := s.updatePosting(ctx, rec, r, retype)
		if err != nil {
			return false, false, err
		}

		changed, retype = posted, kept

		if note != "" {
			notes = append(notes, note)
		}
	}

	if moved {
		note, followed, err := s.followLine(ctx, batchID, rec, r)
		if err != nil {
			return false, false, err
		}

		changed = changed || followed

		if note != "" {
			notes = append(notes, note)
		}
	}

	return true, recordUpdated(rec, r, batchID, notes, applied, retype, changed), nil
}

// updatePosting sends a settled or retyped line to its posting. It returns the note of a
// change the ledger refused, whether the ledger took the change, and whether the retype stays.
func (s *Service) updatePosting(
	ctx context.Context,
	rec *domain.ExternalRecord,
	r domain.NormalizedRecord,
	retype bool,
) (note string, posted, kept bool, err error) {
	posted, err = s.ledger.UpdateImportedPosting(
		ctx,
		rec.BooksID,
		rec.ID,
		r.Pending,
		r.DueDate,
		r.Kind,
	)

	switch {
	case errors.Is(err, ErrReconciled):
		note = "the aggregator reports the line " + strings.ToLower(
			domain.ExternalStatusOf(r),
		) + billNote(
			r.DueDate,
		) + "; the posting is reconciled and keeps its status and statement"
		rec.ReviewReason = domain.ReviewChanged
		retype = false
	case errors.Is(err, ErrNotRetypable):
		note = "the aggregator reports the line as a card payment; the transaction changed since its import and keeps its categories"
		rec.ReviewReason = domain.ReviewChanged
		retype = false
	case err != nil && !errors.Is(err, ErrNotFound):
		return "", false, false, err
	}

	return note, posted, retype, nil
}

// recordUpdated stores the reported facts and the unapplied change on the record and reports
// whether the change is new.
func recordUpdated(
	rec *domain.ExternalRecord,
	r domain.NormalizedRecord,
	batchID uuid.UUID,
	notes []string,
	applied string,
	retype, changed bool,
) bool {
	previous := rec.UnappliedChange

	withFacts(rec, r)

	if !retype {
		// A type the ledger did not take stays unapplied, so a later sync offers it again (A88).
		rec.LineKind = applied
	}

	rec.UnappliedChange = strings.Join(notes, "; ")

	if rec.UnappliedChange == "" && rec.ReviewReason == domain.ReviewChanged {
		rec.ReviewReason = ""
	}

	changed = changed || (rec.UnappliedChange != "" && rec.UnappliedChange != previous)
	if changed && rec.ReviewReason == domain.ReviewChanged {
		rec.Decision, rec.Undo, rec.SummaryBatchID = "", domain.Undo{}, batchID
	}

	return changed
}

// followLine corrects the transaction of a linked line to the line's new amount and date
// (A102) and reports whether the ledger took them. A line equal to the ledger's values needs
// nothing. A reconciled posting keeps them: the record describes the change and is flagged
// with review reason changed. An installment keeps the amount its plan fixes.
func (s *Service) followLine(
	ctx context.Context,
	batchID uuid.UUID,
	rec *domain.ExternalRecord,
	r domain.NormalizedRecord,
) (string, bool, error) {
	if rec.Amount == r.Amount && rec.Date.Equal(r.Date) {
		return "", false, nil
	}

	kept := keptNote(r.Amount, r.Date, rec.Amount, rec.Date)
	if rec.Installment != nil || rec.TransactionID == uuid.Nil {
		return kept, false, nil
	}

	err := s.ledger.ConfirmLine(
		ctx,
		rec.BooksID,
		rec.TransactionID,
		rec.AccountID,
		r.Amount,
		r.Date,
	)
	if errors.Is(err, ErrReconciled) && r.Amount == rec.Amount {
		// Only the date changed: a card posting keeps its statement (A147 rule 3).
		if err = s.ledger.MoveReconciledDate(
			ctx,
			rec.BooksID,
			rec.TransactionID,
			rec.AccountID,
			r.Date,
		); err == nil {
			rec.Decision, rec.Undo, rec.SummaryBatchID = domain.DecisionFollowed, domain.Undo{
				Amount: rec.Amount,
				On:     rec.Date,
			}, batchID
			rec.Date, rec.ReviewReason = r.Date, ""

			return "", true, nil
		}
	}

	switch {
	case errors.Is(err, ErrReconciled):
		rec.ReviewReason = domain.ReviewChanged
		return kept, false, nil
	case errors.Is(err, ErrTransactionVoided), errors.Is(err, ErrNotFound):
		return kept, false, nil
	case err != nil:
		return "", false, err
	}

	rec.Decision, rec.Undo, rec.SummaryBatchID = domain.DecisionFollowed, domain.Undo{
		Amount: rec.Amount,
		On:     rec.Date,
	}, batchID
	rec.Amount, rec.Date, rec.ReviewReason = r.Amount, r.Date, ""

	return "", true, nil
}

// keptNote describes a line the ledger keeps at other values (A102).
func keptNote(reported int64, reportedOn time.Time, amount int64, on time.Time) string {
	return fmt.Sprintf("the aggregator reports %d minor units on %s; the ledger keeps %d on %s",
		reported, reportedOn.Format(time.DateOnly), amount, on.Format(time.DateOnly))
}

// billMatched moves a matched card posting to the statement of the line's bill, as update
// does for a line that keeps its id (P6 A36): a pending charge may come back posted under a
// new id with its bill.
func (s *Service) billMatched(ctx context.Context, rec *domain.ExternalRecord, pending bool) error {
	if rec.DueDate == nil {
		return nil
	}

	_, err := s.ledger.UpdateImportedPosting(ctx, rec.BooksID, rec.ID, pending, rec.DueDate, "")
	switch {
	case errors.Is(err, ErrReconciled):
		rec.ReviewReason = domain.ReviewChanged
		rec.UnappliedChange = "the aggregator reports the line" + billNote(
			rec.DueDate,
		) + "; the posting is reconciled and keeps its status and statement"
	case err != nil && !errors.Is(err, ErrNotFound):
		return err
	}

	return nil
}

func billNote(due *time.Time) string {
	if due == nil {
		return ""
	}

	return " on the bill due " + due.Format(time.DateOnly)
}

func sameDate(a, b *time.Time) bool {
	return (a == nil) == (b == nil) && (a == nil || a.Equal(*b))
}
