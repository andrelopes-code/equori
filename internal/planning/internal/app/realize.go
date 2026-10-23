package app

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
)

const (
	realizedAuto   = "auto"
	realizedManual = "manual"
)

// TransactionChanged is a ledger transaction event Planning reacts to (P7 amendment A51).
type TransactionChanged struct {
	UserID        int64
	TransactionID uuid.UUID
	AccountIDs    []uuid.UUID
}

// HandleTransaction re-evaluates which occurrence the transaction realizes. It returns at
// once when no schedule names one of its accounts; a redelivered event changes nothing.
func (s *Service) HandleTransaction(ctx context.Context, e TransactionChanged) error {
	schedules, err := s.repo.SchedulesTouching(ctx, e.UserID, e.AccountIDs)
	if err != nil || len(schedules) == 0 {
		return err
	}
	facts, err := s.ledger.TransactionFacts(ctx, e.UserID, []uuid.UUID{e.TransactionID})
	if err != nil {
		return err
	}
	t := domain.Transaction{ID: e.TransactionID, Voided: true}
	if len(facts) == 1 {
		t = facts[0]
	}
	current, err := s.repo.OccurrenceByTransaction(ctx, e.UserID, e.TransactionID)
	hasCurrent := err == nil
	if err != nil && !errors.Is(err, ErrNotFound) {
		return err
	}
	if hasCurrent && current.RealizedBy == realizedManual {
		if !t.Voided {
			return nil
		}
		_, err = s.repo.Release(ctx, e.UserID, current.ID, false)
		return err
	}
	var best domain.Candidate
	found := false
	if !t.Voided {
		byID := make(map[uuid.UUID]domain.Schedule, len(schedules))
		ids := make([]uuid.UUID, len(schedules))
		for i, sch := range schedules {
			byID[sch.ID], ids[i] = sch, sch.ID
		}
		os, err := s.repo.ExpectedOccurrences(ctx, e.UserID, ids,
			t.Date.AddDate(0, 0, -domain.MatchWindowDays), t.Date.AddDate(0, 0, domain.MatchWindowDays))
		if err != nil {
			return err
		}
		cs := make([]domain.Candidate, 0, len(os)+1)
		if hasCurrent {
			cs = append(cs, domain.Candidate{Occurrence: current, Schedule: byID[current.ScheduleID]})
		}
		for _, o := range os {
			cs = append(cs, domain.Candidate{Occurrence: o, Schedule: byID[o.ScheduleID]})
		}
		best, found = domain.Match(t, cs)
	}
	if hasCurrent {
		if found && best.Occurrence.ID == current.ID {
			return nil
		}
		if _, err := s.repo.Release(ctx, e.UserID, current.ID, false); err != nil {
			return err
		}
	}
	if !found {
		return nil
	}
	_, err = s.repo.Realize(ctx, e.UserID, best.Occurrence.ID, t.ID, realizedAuto)
	return err
}

// Realize links a chosen transaction to an expected occurrence; re-evaluation never
// releases it (A51).
func (s *Service) Realize(ctx context.Context, userID int64, id, txID uuid.UUID) (OccurrenceView, error) {
	var out OccurrenceView
	err := s.repo.InTx(ctx, func(repo Repository) error {
		o, err := repo.LockOccurrence(ctx, userID, id)
		if err != nil {
			return err
		}
		if o.State != domain.Expected {
			return ErrOccurrenceClosed
		}
		sch, err := repo.Schedule(ctx, userID, o.ScheduleID)
		if err != nil {
			return err
		}
		facts, err := s.ledger.TransactionFacts(ctx, userID, []uuid.UUID{txID})
		if err != nil {
			return err
		}
		if len(facts) == 0 || facts[0].Voided {
			return &domain.FieldError{Field: "transaction_id", Message: "is not a transaction of the user in force", Err: domain.ErrValidation}
		}
		if _, ok := facts[0].On(sch.AccountID); !ok {
			return &domain.FieldError{Field: "transaction_id", Message: "has no posting on the schedule's account", Err: domain.ErrValidation}
		}
		if _, err := repo.OccurrenceByTransaction(ctx, userID, txID); err == nil {
			return ErrTransactionInUse
		} else if !errors.Is(err, ErrNotFound) {
			return err
		}
		realized, err := repo.Realize(ctx, userID, id, txID, realizedManual)
		out = s.view(realized, sch)
		return err
	})
	return out, err
}

// Unrealize releases a realized occurrence; its transaction no longer realizes it automatically
// (final review of P7).
func (s *Service) Unrealize(ctx context.Context, userID int64, id uuid.UUID) (OccurrenceView, error) {
	var out OccurrenceView
	err := s.repo.InTx(ctx, func(repo Repository) error {
		o, err := repo.LockOccurrence(ctx, userID, id)
		if err != nil {
			return err
		}
		if o.State != domain.Realized {
			return ErrOccurrenceClosed
		}
		sch, err := repo.Schedule(ctx, userID, o.ScheduleID)
		if err != nil {
			return err
		}
		released, err := repo.Release(ctx, userID, id, true)
		out = s.view(released, sch)
		return err
	})
	return out, err
}

func (s *Service) view(o domain.Occurrence, sch domain.Schedule) OccurrenceView {
	return OccurrenceView{Occurrence: o, Shown: o.Shown(s.clk.Today(), sch.GraceDays), Currency: sch.Currency}
}

// Occurrence reads one occurrence of the user.
func (s *Service) Occurrence(ctx context.Context, userID int64, id uuid.UUID) (OccurrenceView, error) {
	o, err := s.repo.LockOccurrence(ctx, userID, id)
	if err != nil {
		return OccurrenceView{}, err
	}
	sch, err := s.repo.Schedule(ctx, userID, o.ScheduleID)
	if err != nil {
		return OccurrenceView{}, err
	}
	return s.view(o, sch), nil
}
