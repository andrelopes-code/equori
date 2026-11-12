// Package domain derives positions, realized results and income events of the Portfolio
// context from Ledger facts (docs/domain, 5.6). Amounts are integer units: quantities in
// the security scale, money in the minor units of Facts.Currency.
package domain

import (
	"bytes"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Facts are the non-voided facts of the security accounts of one brokerage.
type Facts struct {
	Currency   money.Currency
	Securities []Security
	Postings   []Posting
	Trades     []Trade
	Incomes    []Income
}

type Security struct {
	AccountID  uuid.UUID
	Instrument money.Currency
	Type       string
	Subtype    string
	Exchange   string
}

type Posting struct {
	AccountID, TransactionID uuid.UUID
	Date                     time.Time
	Quantity, Weight         int64
}

type Trade struct {
	TransactionID, AccountID           uuid.UUID
	Date                               time.Time
	Side                               string
	Quantity, Gross, Fees, Taxes, Cost int64
}

type Income struct {
	TransactionID, AccountID uuid.UUID
	Date                     time.Time
	Type                     string
	Gross, Withheld          int64
}

// PositionDay is a security account after the postings of one date.
type PositionDay struct {
	AccountID           uuid.UUID
	Instrument          money.Currency
	Date                time.Time
	Quantity, CostBasis int64
}

type RealizedResult struct {
	TransactionID, AccountID         uuid.UUID
	Instrument                       money.Currency
	Date, Month                      time.Time
	Quantity, Cost, Proceeds, Result int64
	TaxClass                         string
	Currency                         money.Currency
}

type IncomeEvent struct {
	TransactionID, AccountID uuid.UUID
	Instrument               money.Currency
	Date                     time.Time
	Type, TaxTreatment       string
	Gross, Withheld          int64
	Currency                 money.Currency
}

type Rebuilt struct {
	Days    []PositionDay
	Results []RealizedResult
	Incomes []IncomeEvent
}

// Rebuild derives the Portfolio rows of f (P8 amendment A71): one position row per
// account and date with postings, one result per sale (proceeds = gross − fees), one
// event per income. Tax class and treatment come from j; a nil j leaves both empty.
func Rebuild(f Facts, j Jurisdiction) Rebuilt {
	securities := make(map[uuid.UUID]Security, len(f.Securities))
	for _, s := range f.Securities {
		securities[s.AccountID] = s
	}

	return Rebuilt{
		Days:    positionDays(f.Postings, securities),
		Results: realizedResults(f, securities, j),
		Incomes: incomeEvents(f, securities, j),
	}
}

func positionDays(all []Posting, securities map[uuid.UUID]Security) []PositionDay {
	var days []PositionDay

	postings := slices.Clone(all)
	slices.SortStableFunc(postings, func(a, b Posting) int {
		if c := bytes.Compare(a.AccountID[:], b.AccountID[:]); c != 0 {
			return c
		}

		return a.Date.Compare(b.Date)
	})

	for _, p := range postings {
		n := len(days)
		if n > 0 && days[n-1].AccountID == p.AccountID && days[n-1].Date.Equal(p.Date) {
			days[n-1].Quantity += p.Quantity
			days[n-1].CostBasis += p.Weight

			continue
		}

		day := PositionDay{
			AccountID:  p.AccountID,
			Instrument: securities[p.AccountID].Instrument,
			Date:       p.Date,
			Quantity:   p.Quantity,
			CostBasis:  p.Weight,
		}
		if n > 0 && days[n-1].AccountID == p.AccountID {
			day.Quantity += days[n-1].Quantity
			day.CostBasis += days[n-1].CostBasis
		}

		days = append(days, day)
	}

	return days
}

func realizedResults(f Facts, securities map[uuid.UUID]Security, j Jurisdiction) []RealizedResult {
	var results []RealizedResult

	for _, t := range f.Trades {
		if t.Side != "sell" {
			continue
		}

		s := securities[t.AccountID]
		proceeds := t.Gross - t.Fees

		var taxClass string
		if j != nil {
			taxClass = j.TaxClass(s.Type, s.Subtype, s.Exchange)
		}

		results = append(results, RealizedResult{
			TransactionID: t.TransactionID,
			AccountID:     t.AccountID,
			Instrument:    s.Instrument,
			Date:          t.Date,
			Month:         time.Date(t.Date.Year(), t.Date.Month(), 1, 0, 0, 0, 0, time.UTC),
			Quantity:      t.Quantity,
			Cost:          t.Cost,
			Proceeds:      proceeds,
			Result:        proceeds - t.Cost,
			TaxClass:      taxClass,
			Currency:      f.Currency,
		})
	}

	return results
}

func incomeEvents(f Facts, securities map[uuid.UUID]Security, j Jurisdiction) []IncomeEvent {
	var events []IncomeEvent

	for _, in := range f.Incomes {
		var treatment string
		if j != nil {
			s := securities[in.AccountID]
			treatment = j.Treatment(in.Type, j.TaxClass(s.Type, s.Subtype, s.Exchange))
		}

		events = append(events, IncomeEvent{
			TransactionID: in.TransactionID,
			AccountID:     in.AccountID,
			Instrument:    securities[in.AccountID].Instrument,
			Date:          in.Date,
			Type:          in.Type,
			TaxTreatment:  treatment,
			Gross:         in.Gross,
			Withheld:      in.Withheld,
			Currency:      f.Currency,
		})
	}

	return events
}
