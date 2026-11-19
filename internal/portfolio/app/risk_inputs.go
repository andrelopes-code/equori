package app

import (
	"context"
	"errors"
	"maps"
	"slices"
	"sort"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// sourceAccrual is the price source of an accrual (marketdata, return honesty HR1).
const sourceAccrual = "accrual"

// riskBook is the portfolio of RK1: the brokerage roots, the class of every account of their
// trees and the accounts of each class.
type riskBook struct {
	roots   []uuid.UUID
	classOf map[uuid.UUID]string
	members map[string][]uuid.UUID
}

// riskInputs are the monthly values and flows of the portfolio and of each class, all covering
// the same month ends; accrual is the value of each class priced by accrual.
type riskInputs struct {
	keys      []string
	ends      []time.Time
	portfolio []domain.MonthValue
	classes   map[string][]domain.MonthValue
	accrual   map[string][]int64
}

// classMonth is the value of one class at a month end (RK3).
type classMonth struct {
	value, accrual int64
	state          string
}

func (s *Service) riskBook(ctx context.Context, booksID int64) (riskBook, error) {
	accounts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return riskBook{}, err
	}

	byID := make(map[uuid.UUID]Account, len(accounts))
	for _, a := range accounts {
		byID[a.ID] = a
	}

	book := riskBook{classOf: map[uuid.UUID]string{}, members: map[string][]uuid.UUID{}}
	types := map[money.Currency]string{}

	for _, a := range accounts {
		if !inBrokerageTree(a, byID) {
			continue
		}

		if a.Kind == kindBrokerage && byID[a.ParentID].Kind != kindBrokerage {
			book.roots = append(book.roots, a.ID)
		}

		if _, ok := types[a.Instrument]; !ok {
			info, err := s.md.InstrumentOf(ctx, a.Instrument)
			if err != nil {
				return riskBook{}, err
			}

			types[a.Instrument] = info.Type
		}

		book.classOf[a.ID] = types[a.Instrument]
		book.members[types[a.Instrument]] = append(book.members[types[a.Instrument]], a.ID)
	}

	return book, nil
}

// riskInputs values every class at each month end and spreads the flows over the months.
func (s *Service) riskInputs(
	ctx context.Context,
	booksID int64,
	book riskBook,
	ends []time.Time,
	in money.Currency,
) (riskInputs, error) {
	out := riskInputs{
		keys:      slices.Sorted(maps.Keys(book.members)),
		ends:      ends,
		portfolio: make([]domain.MonthValue, len(ends)),
		classes:   map[string][]domain.MonthValue{},
		accrual:   map[string][]int64{},
	}
	for _, key := range out.keys {
		out.addClass(key)
	}

	for i, end := range ends {
		values, err := s.riskMonth(ctx, booksID, book, end, in)
		if err != nil {
			return riskInputs{}, err
		}

		out.setMonth(i, values)
	}

	if err := s.addRiskFlows(ctx, booksID, book, in, &out); err != nil {
		return riskInputs{}, err
	}

	return out, nil
}

// riskMonth values the own balance of every account of the portfolio at end, by class (RK3).
func (s *Service) riskMonth(
	ctx context.Context,
	booksID int64,
	book riskBook,
	end time.Time,
	in money.Currency,
) (map[string]classMonth, error) {
	balances, err := s.ledger.Balances(ctx, booksID, end)
	if err != nil {
		return nil, err
	}

	s.warm(ctx, end, balanceCodes(balances, in))

	start := time.Date(end.Year(), end.Month(), 1, 0, 0, 0, 0, end.Location())
	out := map[string]classMonth{}

	for _, b := range balances {
		key, ok := book.classOf[b.AccountID]
		if !ok || b.Amount.IsZero() {
			continue
		}

		c := out[key]
		if err := s.addRiskValue(ctx, &c, b.Amount, in, start, end); err != nil {
			return nil, err
		}

		out[key] = c
	}

	return out, nil
}

// addRiskValue adds amount valued at end to c; a missing price makes c missing, a price dated
// before start makes it stale (RK3), and a price of an accrual counts the value as accrued (RK11).
func (s *Service) addRiskValue(
	ctx context.Context,
	c *classMonth,
	amount money.Money,
	in money.Currency,
	start, end time.Time,
) error {
	if amount.Currency() == in {
		c.value += amount.Amount()
		return nil
	}

	v, prices, err := s.value(ctx, amount, in, end)
	if errors.Is(err, ErrPriceMissing) {
		c.state = worse(c.state, domain.MonthMissing)
		return nil
	}

	if err != nil {
		return err
	}

	c.value += v.Amount()

	accrued := false
	for _, p := range prices {
		if p.Date.Before(start) {
			c.state = worse(c.state, domain.MonthStale)
		}

		accrued = accrued || p.Source == sourceAccrual
	}

	if accrued {
		c.accrual += v.Amount()
	}

	return nil
}

// addRiskFlows adds the flows of the portfolio and of each security class to their months. The
// flows of the cash are those of the portfolio less those of the security classes, date by date
// (RK4): a purchase paid from the cash and an income paid into it move money between classes.
func (s *Service) addRiskFlows(
	ctx context.Context,
	booksID int64,
	book riskBook,
	in money.Currency,
	out *riskInputs,
) error {
	from, to := previousMonthEnd(out.ends[0]).AddDate(0, 0, 1), out.ends[len(out.ends)-1]

	flows, err := s.ledger.ExternalFlows(ctx, booksID, book.roots, from, to)
	if err != nil {
		return err
	}

	cash := map[time.Time]int64{}
	if err := s.spreadFlows(ctx, "", flows, in, out, cash, 1); err != nil {
		return err
	}

	for _, key := range out.keys {
		if key == typeCurrency {
			continue
		}

		flows, err := s.ledger.ExternalFlows(ctx, booksID, book.members[key], from, to)
		if err != nil {
			return err
		}

		if err := s.spreadFlows(ctx, key, flows, in, out, cash, -1); err != nil {
			return err
		}
	}

	for _, date := range slices.SortedFunc(maps.Keys(cash), time.Time.Compare) {
		if cash[date] != 0 {
			out.addClass(typeCurrency)
			out.addFlow(typeCurrency, date, cash[date])
		}
	}

	return nil
}

// spreadFlows values each flow in in on its date and adds it to the month of key ("" for the
// portfolio); sign × amount accumulates in cash. A flow without a price makes its month
// missing for the class and for the portfolio.
func (s *Service) spreadFlows(
	ctx context.Context,
	key string,
	flows []Flow,
	in money.Currency,
	out *riskInputs,
	cash map[time.Time]int64,
	sign int64,
) error {
	for _, f := range flows {
		v, err := s.valueIn(ctx, f.Value, in, f.Date)
		if errors.Is(err, ErrPriceMissing) {
			out.markMissing(key, f.Date)
			continue
		}

		if err != nil {
			return err
		}

		out.addFlow(key, f.Date, v.Amount())
		cash[f.Date] += sign * v.Amount()
	}

	return nil
}

func (r *riskInputs) addClass(key string) {
	if _, ok := r.classes[key]; ok {
		return
	}

	months := make([]domain.MonthValue, len(r.ends))
	for i, end := range r.ends {
		months[i].End = end
	}

	if !slices.Contains(r.keys, key) {
		r.keys = append(r.keys, key)
	}

	r.classes[key] = months
	r.accrual[key] = make([]int64, len(r.ends))
}

// setMonth stores the class values of month i and their sum as the portfolio's value.
func (r *riskInputs) setMonth(i int, values map[string]classMonth) {
	r.portfolio[i].End = r.ends[i]

	for _, key := range r.keys {
		c := values[key]
		r.classes[key][i].Value, r.classes[key][i].State = c.value, c.state
		r.accrual[key][i] = c.accrual
		r.portfolio[i].Value += c.value
		r.portfolio[i].State = worse(r.portfolio[i].State, c.state)
	}
}

func (r *riskInputs) addFlow(key string, date time.Time, amount int64) {
	m := r.month(key, date)
	m.Flows = append(m.Flows, domain.CashFlow{Date: date, Amount: amount})
}

func (r *riskInputs) markMissing(key string, date time.Time) {
	m := r.month(key, date)
	m.State = domain.MonthMissing
	r.month("", date).State = domain.MonthMissing
}

// month is the month of key ("" for the portfolio) that holds date: the first that ends on or
// after it.
func (r *riskInputs) month(key string, date time.Time) *domain.MonthValue {
	i := sort.Search(len(r.ends), func(i int) bool { return !r.ends[i].Before(date) })
	if key == "" {
		return &r.portfolio[i]
	}

	return &r.classes[key][i]
}

// worse is the state of a month with both states: missing wins over stale, stale over known.
func worse(a, b string) string {
	if a == domain.MonthMissing || b == domain.MonthMissing {
		return domain.MonthMissing
	}

	if a == domain.MonthStale || b == domain.MonthStale {
		return domain.MonthStale
	}

	return ""
}

// inBrokerageTree reports whether a or one of its ancestors is a brokerage account.
func inBrokerageTree(a Account, byID map[uuid.UUID]Account) bool {
	for seen := 0; seen < len(byID); seen++ {
		if a.Kind == kindBrokerage {
			return true
		}

		parent, ok := byID[a.ParentID]
		if !ok {
			return false
		}

		a = parent
	}

	return false
}
