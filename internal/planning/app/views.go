package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/domain"
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
func (s *Service) Project(ctx context.Context, booksID int64, accountID uuid.UUID, to time.Time) (Projection, error) {
	today := s.clk.Today(ctx)
	if !to.After(today) || to.After(s.horizon(ctx)) {
		return Projection{}, &domain.FieldError{Field: "to", Message: "must be after today and at most today + 12 months", Err: domain.ErrValidation}
	}

	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return Projection{}, err
	}

	i := slices.IndexFunc(facts, func(a Account) bool { return a.ID == accountID })
	if i < 0 || (facts[i].Class != "asset" && facts[i].Class != "liability") {
		return Projection{}, &domain.FieldError{Field: "id", Message: "must be a balance account of the book", Err: domain.ErrValidation}
	}

	schedules, err := s.repo.SchedulesTouching(ctx, booksID, []uuid.UUID{accountID})
	if err != nil {
		return Projection{}, err
	}

	os, err := s.repo.Occurrences(ctx, booksID, beginning, to, uuid.Nil)
	if err != nil {
		return Projection{}, err
	}

	points := projectionPoints(os, indexSchedules(schedules), accountID, today)
	sortPoints(points)

	opening, closing, err := s.openingClosing(ctx, booksID, accountID, today, to)
	if err != nil {
		return Projection{}, err
	}

	closing = runBalances(points, opening, closing)

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
func (s *Service) Committed(ctx context.Context, booksID int64, month time.Time) (Committed, error) {
	month = domain.MonthOf(month)

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return Committed{}, err
	}

	out := Committed{Month: month, Currency: base}

	facts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return Committed{}, err
	}

	installments, err := s.cardInstallments(ctx, booksID, month, base, facts)
	if err != nil {
		return Committed{}, err
	}

	out.Installments = installments

	schedules, err := s.repo.Schedules(ctx, booksID)
	if err != nil {
		return Committed{}, err
	}

	os, err := s.repo.Occurrences(ctx, booksID, month, month.AddDate(0, 1, -1), uuid.Nil)
	if err != nil {
		return Committed{}, err
	}

	if err := s.committedOccurrences(ctx, &out, os, indexSchedules(schedules)); err != nil {
		return Committed{}, err
	}

	out.Total = out.Installments + out.Occurrences

	return out, nil
}

// projectionPoints turns the expected occurrences of the schedules into points; a past date
// counts as today.
func projectionPoints(
	os []domain.Occurrence,
	byID map[uuid.UUID]domain.Schedule,
	accountID uuid.UUID,
	today time.Time,
) []Point {
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

	return points
}

// sortPoints orders the points by date, then by amount.
func sortPoints(points []Point) {
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
}

// openingClosing returns the balance of the account on today and on to.
func (s *Service) openingClosing(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	today, to time.Time,
) (int64, int64, error) {
	openingBalance, err := s.ledger.Balance(ctx, booksID, accountID, today)
	if errors.Is(err, ErrMixedInstruments) {
		return 0, 0, &CurrencyError{Field: "id"}
	}

	if err != nil {
		return 0, 0, err
	}

	closingBalance, err := s.ledger.Balance(ctx, booksID, accountID, to)
	if err != nil {
		return 0, 0, err
	}

	return openingBalance.Amount(), closingBalance.Amount(), nil
}

// runBalances sets the running balance of each point from opening and returns the closing
// balance after every point.
func runBalances(points []Point, opening, closing int64) int64 {
	running := opening
	for j := range points {
		running += points[j].Amount
		points[j].Balance = running
		closing += points[j].Amount
	}

	return closing
}

// cardInstallments adds the commitments of month of the credit cards in the base currency.
func (s *Service) cardInstallments(
	ctx context.Context,
	booksID int64,
	month time.Time,
	base money.Currency,
	facts []Account,
) (int64, error) {
	var total int64
	for _, a := range facts {
		if a.Kind != "credit_card" || a.Instrument != base {
			continue
		}

		c, err := s.ledger.Commitment(ctx, booksID, a.ID, month)
		if err != nil {
			return 0, err
		}

		total += c
	}

	return total, nil
}

// committedOccurrences adds to out the expected occurrences of the committed kinds, valued in
// the base currency at today's prices (A72).
func (s *Service) committedOccurrences(
	ctx context.Context,
	out *Committed,
	os []domain.Occurrence,
	byID map[uuid.UUID]domain.Schedule,
) error {
	today := s.clk.Today(ctx)
	for _, o := range os {
		sch := byID[o.ScheduleID]
		if o.State != domain.Expected || !committedKinds[sch.Kind] {
			continue
		}

		amount := o.Amount
		if sch.Currency != out.Currency {
			// P8 amendment A72: valued in the base currency at today's prices.
			m, err := money.New(o.Amount, sch.Currency)
			if err != nil {
				return err
			}

			v, used, err := s.prices.Convert(ctx, m, out.Currency, today)
			if err != nil {
				return err
			}

			amount, out.Prices = v.Amount(), append(out.Prices, used...)
		}

		out.Occurrences += amount
	}

	return nil
}
