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

// cashHolding is the holding that gathers every cash account of the portfolio (RK4).
const cashHolding = "cash"

// riskBook is the portfolio of RK1: the brokerage roots, the class of every account of their
// trees and the holding each account counts in: itself for a security, the cash otherwise.
type riskBook struct {
	roots        []uuid.UUID
	classOf      map[uuid.UUID]string
	holdingOf    map[uuid.UUID]string
	instrumentOf map[uuid.UUID]money.Currency
}

// riskHolding is the monthly value, flows and value priced by accrual of one holding; the
// instrument of a security, empty for the cash.
type riskHolding struct {
	class      string
	instrument money.Currency
	months     []domain.MonthValue
	accrual    []int64
}

// riskInputs are the holdings of the portfolio over the same month ends.
type riskInputs struct {
	ends     []time.Time
	holdings map[string]*riskHolding
}

// holdingMonth is the value of one account at a month end (RK3).
type holdingMonth struct {
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

	book := riskBook{
		classOf:      map[uuid.UUID]string{},
		holdingOf:    map[uuid.UUID]string{},
		instrumentOf: map[uuid.UUID]money.Currency{},
	}
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
		book.holdingOf[a.ID] = a.ID.String()
		book.instrumentOf[a.ID] = a.Instrument

		if types[a.Instrument] == typeCurrency {
			book.holdingOf[a.ID] = cashHolding
		}
	}

	return book, nil
}

// riskInputs values every holding at each month end and spreads the flows over the months.
func (s *Service) riskInputs(
	ctx context.Context,
	booksID int64,
	book riskBook,
	ends []time.Time,
	in money.Currency,
) (riskInputs, error) {
	out := riskInputs{ends: ends, holdings: map[string]*riskHolding{}}
	for id, holding := range book.holdingOf {
		out.add(holding, book.classOf[id])

		if holding != cashHolding {
			out.holdings[holding].instrument = book.instrumentOf[id]
		}
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

// riskMonth values the own balance of every account of the portfolio at end, by holding (RK3).
func (s *Service) riskMonth(
	ctx context.Context,
	booksID int64,
	book riskBook,
	end time.Time,
	in money.Currency,
) (map[string]holdingMonth, error) {
	balances, err := s.ledger.Balances(ctx, booksID, end)
	if err != nil {
		return nil, err
	}

	s.warm(ctx, end, balanceCodes(balances, in))

	start := time.Date(end.Year(), end.Month(), 1, 0, 0, 0, 0, end.Location())
	out := map[string]holdingMonth{}

	for _, b := range balances {
		holding, ok := book.holdingOf[b.AccountID]
		if !ok || b.Amount.IsZero() {
			continue
		}

		h := out[holding]
		if err := s.addRiskValue(ctx, &h, b.Amount, in, start, end); err != nil {
			return nil, err
		}

		out[holding] = h
	}

	return out, nil
}

// addRiskValue adds amount valued at end to h; a missing price makes h missing, a price dated
// before start makes it stale (RK3), and a price of an accrual counts the value as accrued (RK11).
// A stale value still counts: it measures the share of the value a month leaves out.
func (s *Service) addRiskValue(
	ctx context.Context,
	h *holdingMonth,
	amount money.Money,
	in money.Currency,
	start, end time.Time,
) error {
	if amount.Currency() == in {
		h.value += amount.Amount()
		return nil
	}

	v, prices, err := s.value(ctx, amount, in, end)
	if errors.Is(err, ErrPriceMissing) {
		h.state = worse(h.state, domain.MonthMissing)
		return nil
	}

	if err != nil {
		return err
	}

	h.value += v.Amount()

	accrued := false
	for _, p := range prices {
		if p.Date.Before(start) {
			h.state = worse(h.state, domain.MonthStale)
		}

		accrued = accrued || p.Source == sourceAccrual
	}

	if accrued {
		h.accrual += v.Amount()
	}

	return nil
}

// addRiskFlows adds the flows of each security holding to its months. The flows of the cash are
// those of the portfolio less those of the securities, date by date (RK4): a purchase paid from
// the cash and an income paid into it move money between holdings.
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
	if err := s.spreadFlows(ctx, cashHolding, flows, in, out, cash, 1); err != nil {
		return err
	}

	for _, id := range slices.SortedFunc(maps.Keys(book.holdingOf), compareUUID) {
		if book.holdingOf[id] == cashHolding {
			continue
		}

		flows, err := s.ledger.ExternalFlows(ctx, booksID, []uuid.UUID{id}, from, to)
		if err != nil {
			return err
		}

		if err := s.spreadFlows(ctx, id.String(), flows, in, out, cash, -1); err != nil {
			return err
		}
	}

	for _, date := range slices.SortedFunc(maps.Keys(cash), time.Time.Compare) {
		if cash[date] != 0 {
			out.add(cashHolding, typeCurrency)
			out.addFlow(cashHolding, date, cash[date])
		}
	}

	return nil
}

// spreadFlows values each flow in in on its date; sign × amount accumulates in cash, and a
// security's flow is also a flow of its holding. A flow without a price makes the month of its
// holding missing, and the month of the cash for a flow of the portfolio.
func (s *Service) spreadFlows(
	ctx context.Context,
	holding string,
	flows []Flow,
	in money.Currency,
	out *riskInputs,
	cash map[time.Time]int64,
	sign int64,
) error {
	for _, f := range flows {
		v, err := s.valueIn(ctx, f.Value, in, f.Date)
		if errors.Is(err, ErrPriceMissing) {
			out.add(holding, typeCurrency)
			out.month(holding, f.Date).State = domain.MonthMissing

			continue
		}

		if err != nil {
			return err
		}

		cash[f.Date] += sign * v.Amount()

		if holding != cashHolding {
			out.addFlow(holding, f.Date, v.Amount())
		}
	}

	return nil
}

// add registers a holding of class; a known holding keeps its class.
func (r *riskInputs) add(holding, class string) {
	if _, ok := r.holdings[holding]; ok {
		return
	}

	months := make([]domain.MonthValue, len(r.ends))
	for i, end := range r.ends {
		months[i].End = end
	}

	r.holdings[holding] = &riskHolding{
		class:   class,
		months:  months,
		accrual: make([]int64, len(r.ends)),
	}
}

// setMonth stores the values of month i.
func (r *riskInputs) setMonth(i int, values map[string]holdingMonth) {
	for holding, h := range r.holdings {
		v := values[holding]
		h.months[i].Value, h.months[i].State = v.value, v.state
		h.accrual[i] = v.accrual
	}
}

func (r *riskInputs) addFlow(holding string, date time.Time, amount int64) {
	m := r.month(holding, date)
	m.Flows = append(m.Flows, domain.CashFlow{Date: date, Amount: amount})
}

// month is the month of the holding that holds date: the first that ends on or after it.
func (r *riskInputs) month(holding string, date time.Time) *domain.MonthValue {
	i := sort.Search(len(r.ends), func(i int) bool { return !r.ends[i].Before(date) })

	return &r.holdings[holding].months[i]
}

// classes lists the classes of the holdings, sorted.
func (r *riskInputs) classes() []string {
	set := map[string]bool{}
	for _, h := range r.holdings {
		set[h.class] = true
	}

	return slices.Sorted(maps.Keys(set))
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

func compareUUID(a, b uuid.UUID) int {
	return slices.Compare(a[:], b[:])
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
