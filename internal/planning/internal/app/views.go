package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Point is one expected occurrence on a projected account with the running balance after it.
type Point struct {
	Date                     time.Time
	OccurrenceID, ScheduleID uuid.UUID
	Amount, Balance          int64
}

type Projection struct {
	AccountID        uuid.UUID
	From, To         time.Time
	Opening, Closing int64
	Currency         money.Currency
	Points           []Point
}

// beginning bounds the occurrence reads that must include every pending one.
var beginning = time.Date(1, 1, 1, 0, 0, 0, 0, time.UTC)

// Project returns the projection of a balance account to date to (P7 amendment A56).
func (s *Service) Project(ctx context.Context, userID int64, accountID uuid.UUID, to time.Time) (Projection, error) {
	today := s.clk.Today()
	if !to.After(today) || to.After(s.horizon()) {
		return Projection{}, &domain.FieldError{Field: "to", Message: "must be after today and at most today + 12 months", Err: domain.ErrValidation}
	}
	facts, err := s.ledger.AccountFacts(ctx, userID)
	if err != nil {
		return Projection{}, err
	}
	i := slices.IndexFunc(facts, func(a Account) bool { return a.ID == accountID })
	if i < 0 || (facts[i].Class != "asset" && facts[i].Class != "liability") {
		return Projection{}, &domain.FieldError{Field: "id", Message: "must be a balance account of the user", Err: domain.ErrValidation}
	}
	schedules, err := s.repo.SchedulesTouching(ctx, userID, []uuid.UUID{accountID})
	if err != nil {
		return Projection{}, err
	}
	byID := make(map[uuid.UUID]domain.Schedule, len(schedules))
	for _, sch := range schedules {
		byID[sch.ID] = sch
	}
	os, err := s.repo.Occurrences(ctx, userID, beginning, to, uuid.Nil)
	if err != nil {
		return Projection{}, err
	}
	var points []Point
	for _, o := range os {
		sch, ok := byID[o.ScheduleID]
		if !ok || o.State != domain.Expected {
			continue
		}
		amount := o.Amount
		if sch.AccountID == accountID && sch.Kind.Outflow() {
			amount = -amount
		}
		date := o.ExpectedOn
		if date.Before(today) {
			date = today
		}
		points = append(points, Point{Date: date, OccurrenceID: o.ID, ScheduleID: o.ScheduleID, Amount: amount})
	}
	slices.SortStableFunc(points, func(a, b Point) int {
		if c := a.Date.Compare(b.Date); c != 0 {
			return c
		}
		switch {
		case a.Amount < b.Amount:
			return -1
		case a.Amount > b.Amount:
			return 1
		}
		return 0
	})
	openingBalance, err := s.ledger.Balance(ctx, userID, accountID, today)
	if errors.Is(err, ErrMixedInstruments) {
		return Projection{}, &CurrencyError{Field: "id"}
	}
	if err != nil {
		return Projection{}, err
	}
	closingBalance, err := s.ledger.Balance(ctx, userID, accountID, to)
	if err != nil {
		return Projection{}, err
	}
	opening, closing := openingBalance.Amount(), closingBalance.Amount()
	running := opening
	for j := range points {
		running += points[j].Amount
		points[j].Balance = running
		closing += points[j].Amount
	}
	return Projection{AccountID: accountID, From: today, To: to, Opening: opening, Closing: closing, Currency: facts[i].Instrument, Points: points}, nil
}

type Committed struct {
	Month                            time.Time
	Installments, Occurrences, Total int64
	Currency                         money.Currency
	Prices                           []Price
}

// committedKinds are the schedule kinds a committed amount counts (A57).
var committedKinds = map[domain.Kind]bool{domain.Bill: true, domain.Subscription: true, domain.Savings: true}

// Committed returns the installments and the expected occurrences committed in month (A57).
func (s *Service) Committed(ctx context.Context, userID int64, month time.Time) (Committed, error) {
	month = domain.MonthOf(month)
	base, err := s.ledger.BaseCurrency(ctx, userID)
	if err != nil {
		return Committed{}, err
	}
	out := Committed{Month: month, Currency: base}
	facts, err := s.ledger.AccountFacts(ctx, userID)
	if err != nil {
		return Committed{}, err
	}
	for _, a := range facts {
		if a.Kind != "credit_card" || a.Instrument != base {
			continue
		}
		c, err := s.ledger.Commitment(ctx, userID, a.ID, month)
		if err != nil {
			return Committed{}, err
		}
		out.Installments += c
	}
	schedules, err := s.repo.Schedules(ctx, userID)
	if err != nil {
		return Committed{}, err
	}
	byID := make(map[uuid.UUID]domain.Schedule, len(schedules))
	for _, sch := range schedules {
		byID[sch.ID] = sch
	}
	os, err := s.repo.Occurrences(ctx, userID, month, month.AddDate(0, 1, -1), uuid.Nil)
	if err != nil {
		return Committed{}, err
	}
	today := s.clk.Today()
	for _, o := range os {
		sch := byID[o.ScheduleID]
		if o.State != domain.Expected || !committedKinds[sch.Kind] {
			continue
		}
		amount := o.Amount
		if sch.Currency != base {
			// P8 amendment A72: valued in the base currency at today's prices.
			m, err := money.New(o.Amount, sch.Currency)
			if err != nil {
				return Committed{}, err
			}
			v, used, err := s.prices.Convert(ctx, m, base, today)
			if err != nil {
				return Committed{}, err
			}
			amount, out.Prices = v.Amount(), append(out.Prices, used...)
		}
		out.Occurrences += amount
	}
	out.Total = out.Installments + out.Occurrences
	return out, nil
}
