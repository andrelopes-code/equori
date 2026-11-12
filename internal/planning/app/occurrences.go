package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// maxRangeDays bounds an occurrence range (P7 Global Constraints).
const maxRangeDays = 366

// OccurrenceView is an occurrence with the state the API reads.
type OccurrenceView struct {
	domain.Occurrence
	Shown    domain.State
	Currency money.Currency
	// Actual is what the realized transaction moved on the schedule account, in minor units of
	// Currency; nil unless the occurrence is realized and its transaction is known.
	Actual *int64
}

// Occurrences lists the occurrences with expected date in [from, to]; state filters by the
// state read, overdue included.
func (s *Service) Occurrences(
	ctx context.Context,
	booksID int64,
	from, to time.Time,
	scheduleID uuid.UUID,
	state domain.State,
) ([]OccurrenceView, error) {
	if to.Before(from) || to.Sub(from) > maxRangeDays*24*time.Hour {
		return nil, &domain.FieldError{
			Field:   "to",
			Message: "must be on or after from, at most 366 days later",
			Err:     domain.ErrValidation,
		}
	}

	os, err := s.repo.Occurrences(ctx, booksID, from, to, scheduleID)
	if err != nil {
		return nil, err
	}

	return s.occurrenceViews(ctx, booksID, os, state)
}

// OccurrencesOfTransaction returns the occurrences the transaction realized, whatever their date.
func (s *Service) OccurrencesOfTransaction(
	ctx context.Context,
	booksID int64,
	txID uuid.UUID,
) ([]OccurrenceView, error) {
	os, err := s.repo.OccurrencesOfTransaction(ctx, booksID, txID)
	if err != nil {
		return nil, err
	}

	return s.occurrenceViews(ctx, booksID, os, "")
}

func (s *Service) occurrenceViews(
	ctx context.Context,
	booksID int64,
	os []domain.Occurrence,
	state domain.State,
) ([]OccurrenceView, error) {
	schedules, err := s.repo.Schedules(ctx, booksID)
	if err != nil {
		return nil, err
	}

	byID := make(map[uuid.UUID]domain.Schedule, len(schedules))
	for _, sch := range schedules {
		byID[sch.ID] = sch
	}

	today := s.clk.Today(ctx)

	out := make([]OccurrenceView, 0, len(os))
	for _, o := range os {
		sch := byID[o.ScheduleID]

		v := OccurrenceView{
			Occurrence: o,
			Shown:      o.Shown(today, sch.GraceDays),
			Currency:   sch.Currency,
		}
		if state == "" || v.Shown == state {
			out = append(out, v)
		}
	}

	if err := s.fillActuals(ctx, booksID, out, byID); err != nil {
		return nil, err
	}

	return out, nil
}

// fillActuals sets Actual on the realized views with one TransactionFacts call; a view whose
// transaction is missing from the facts keeps Actual nil.
func (s *Service) fillActuals(
	ctx context.Context,
	booksID int64,
	views []OccurrenceView,
	schedules map[uuid.UUID]domain.Schedule,
) error {
	var ids []uuid.UUID
	for _, v := range views {
		if v.State == domain.Realized {
			ids = append(ids, v.TransactionID)
		}
	}

	if len(ids) == 0 {
		return nil
	}

	facts, err := s.ledger.TransactionFacts(ctx, booksID, ids)
	if err != nil {
		return err
	}

	byID := make(map[uuid.UUID]domain.Transaction, len(facts))
	for _, t := range facts {
		byID[t.ID] = t
	}

	for i, v := range views {
		t, ok := byID[v.TransactionID]
		if v.State != domain.Realized || !ok {
			continue
		}

		if amount, found := domain.ActualAmount(t, schedules[v.ScheduleID]); found {
			views[i].Actual = &amount
		}
	}

	return nil
}
