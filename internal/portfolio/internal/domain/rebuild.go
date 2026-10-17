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

const (
	TreatmentExempt    = "exempt"
	TreatmentExclusive = "exclusive"
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
	TaxClass   string
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
// event per income (dividends exempt, other types taxed exclusively at source).
func Rebuild(f Facts) Rebuilt {
	securities := make(map[uuid.UUID]Security, len(f.Securities))
	for _, s := range f.Securities {
		securities[s.AccountID] = s
	}
	var out Rebuilt

	postings := slices.Clone(f.Postings)
	slices.SortStableFunc(postings, func(a, b Posting) int {
		if c := bytes.Compare(a.AccountID[:], b.AccountID[:]); c != 0 {
			return c
		}
		return a.Date.Compare(b.Date)
	})
	for _, p := range postings {
		n := len(out.Days)
		if n > 0 && out.Days[n-1].AccountID == p.AccountID && out.Days[n-1].Date.Equal(p.Date) {
			out.Days[n-1].Quantity += p.Quantity
			out.Days[n-1].CostBasis += p.Weight
			continue
		}
		day := PositionDay{AccountID: p.AccountID, Instrument: securities[p.AccountID].Instrument, Date: p.Date, Quantity: p.Quantity, CostBasis: p.Weight}
		if n > 0 && out.Days[n-1].AccountID == p.AccountID {
			day.Quantity += out.Days[n-1].Quantity
			day.CostBasis += out.Days[n-1].CostBasis
		}
		out.Days = append(out.Days, day)
	}

	for _, t := range f.Trades {
		if t.Side != "sell" {
			continue
		}
		s := securities[t.AccountID]
		proceeds := t.Gross - t.Fees
		out.Results = append(out.Results, RealizedResult{
			TransactionID: t.TransactionID, AccountID: t.AccountID, Instrument: s.Instrument,
			Date: t.Date, Month: time.Date(t.Date.Year(), t.Date.Month(), 1, 0, 0, 0, 0, time.UTC),
			Quantity: t.Quantity, Cost: t.Cost, Proceeds: proceeds, Result: proceeds - t.Cost, TaxClass: s.TaxClass, Currency: f.Currency,
		})
	}

	for _, in := range f.Incomes {
		treatment := TreatmentExclusive
		if in.Type == "dividend" {
			treatment = TreatmentExempt
		}
		out.Incomes = append(out.Incomes, IncomeEvent{
			TransactionID: in.TransactionID, AccountID: in.AccountID, Instrument: securities[in.AccountID].Instrument, Date: in.Date,
			Type: in.Type, TaxTreatment: treatment, Gross: in.Gross, Withheld: in.Withheld, Currency: f.Currency,
		})
	}
	return out
}
