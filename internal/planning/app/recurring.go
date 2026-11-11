package app

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/textfold"
)

const (
	// seriesWindowDays is how far back the detector reads transactions (spec 2026-11-03 §6).
	seriesWindowDays = 400
)

type RecurringFilter struct {
	PayeeID, AccountID uuid.UUID // uuid.Nil: any
	Text               string    // folded match on Key; empty: any
	// Probe, when set, is added to the facts before detection; Recurring then returns only its series.
	Probe *domain.SeriesFact
}

// Recurring returns the series of the book, filtered; ScheduleID is the active schedule that
// covers the series.
func (s *Service) Recurring(ctx context.Context, booksID int64, f RecurringFilter) ([]domain.Series, error) {
	facts, err := s.seriesFacts(ctx, booksID, f.AccountID)
	if err != nil {
		return nil, err
	}

	if f.Probe != nil {
		facts = append(facts, *f.Probe)
	}

	schedules, err := s.repo.Schedules(ctx, booksID)
	if err != nil {
		return nil, err
	}

	today := s.clk.Today(ctx)

	var out []domain.Series

	for _, sr := range domain.DetectSeries(facts) {
		if !f.matches(sr) {
			continue
		}

		sr.ScheduleID = coveringSchedule(sr, schedules, today)
		out = append(out, sr)
	}

	return out, nil
}

func (f RecurringFilter) matches(s domain.Series) bool {
	switch {
	case f.Probe != nil && (s.AccountID != f.Probe.AccountID || s.Key != f.Probe.Key):
		return false
	case f.PayeeID != uuid.Nil && s.PayeeID != f.PayeeID:
		return false
	case f.AccountID != uuid.Nil && s.AccountID != f.AccountID:
		return false
	}

	return strings.Contains(textfold.String(s.Key), textfold.String(f.Text))
}

// seriesFacts reads the expenses of the open balance accounts in the detector window.
func (s *Service) seriesFacts(ctx context.Context, booksID int64, only uuid.UUID) ([]domain.SeriesFact, error) {
	accounts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return nil, err
	}

	classes := make(map[uuid.UUID]string, len(accounts))
	for _, a := range accounts {
		classes[a.ID] = a.Class
	}

	today := s.clk.Today(ctx)
	from := today.AddDate(0, 0, -seriesWindowDays)

	var out []domain.SeriesFact

	for _, a := range accounts {
		if a.Closed || (a.Class != "asset" && a.Class != "liability") || (only != uuid.Nil && a.ID != only) {
			continue
		}

		ids, err := s.ledger.AccountTransactionsBetween(ctx, booksID, a.ID, from, today)
		if err != nil {
			return nil, err
		}

		txs, err := s.ledger.TransactionFacts(ctx, booksID, ids)
		if err != nil {
			return nil, err
		}

		for _, t := range txs {
			if f, ok := seriesFact(t, a.ID, classes); ok {
				out = append(out, f)
			}
		}
	}

	return out, nil
}

// seriesFact is the expense t books on account: the sum of its expense postings and the expense
// account of the largest one. ok is false for a voided transaction, one without an expense
// amount and one without a payee or description.
func seriesFact(t domain.Transaction, account uuid.UUID, classes map[uuid.UUID]string) (domain.SeriesFact, bool) {
	if t.Voided {
		return domain.SeriesFact{}, false
	}

	var amount, largest int64

	var category uuid.UUID

	for _, p := range t.Postings {
		if classes[p.AccountID] != "expense" {
			continue
		}

		amount += p.Amount

		if p.Amount > largest {
			largest, category = p.Amount, p.AccountID
		}
	}

	key := textfold.String(t.Description)
	if t.PayeeID != uuid.Nil {
		key = t.PayeeID.String()
	}

	if amount <= 0 || key == "" {
		return domain.SeriesFact{}, false
	}

	return domain.SeriesFact{
		TransactionID: t.ID, AccountID: account, CategoryID: category, PayeeID: t.PayeeID,
		Key: key, Date: t.Date, Amount: amount,
	}, true
}

// coveringSchedule is the rule of plan B: an active schedule on the series account with the same
// payee or, without payee, the same folded description. uuid.Nil when none.
func coveringSchedule(s domain.Series, schedules []domain.Schedule, today time.Time) uuid.UUID {
	for _, sch := range schedules {
		if sch.AccountID != s.AccountID || (sch.EndsOn != nil && sch.EndsOn.Before(today)) {
			continue
		}

		if s.PayeeID != uuid.Nil && sch.PayeeID == s.PayeeID {
			return sch.ID
		}

		if s.PayeeID == uuid.Nil && textfold.String(sch.Description) == s.Key {
			return sch.ID
		}
	}

	return uuid.Nil
}
