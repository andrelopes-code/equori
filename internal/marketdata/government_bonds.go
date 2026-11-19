package marketdata

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/index"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
)

const (
	// ntnfCoupon is what one NTN-F pays every 6 months: 1,000.00 × (1.10^½ − 1), the coupon of
	// 10% a year of the Metodologia de Cálculo dos Títulos Públicos Federais of the Tesouro.
	ntnfCoupon = "48.808848170152"
	// bondFace is the 1,000.00 an LTN and an NTN-F pay at maturity.
	bondFace = "1000.000000000000"
	// bondHistoryYears bounds the coupons listed before the maturity of a bond.
	bondHistoryYears = 40

	returnKindRate      = "rate"
	returnKindInflation = "inflation"
	returnKindFixed     = "fixed"
)

// monthlyPayments are the monthly payments of the principal of a bond of income: 240 for an
// RendA+, 60 for an Educa+, the last on the maturity (coverage rows T-06, T-07).
var monthlyPayments = map[string]int{"RENDA": 240, "EDUCA": 60}

// governmentBondCode is the listing code of a Brazilian government bond of the tesouro_direto
// feed: its kind and its maturity as YYYYMMDD.
var governmentBondCode = regexp.MustCompile(
	`^(LFT|LTN|NTNF|NTNB|NTNBP|NTNC|RENDA|EDUCA)\.([0-9]{8})$`,
)

// governmentBondReturnKind is the return kind of each government bond kind (contribution rules
// GR3).
var governmentBondReturnKind = map[string]string{
	"LFT":   returnKindRate,
	"LTN":   returnKindFixed,
	"NTNF":  returnKindFixed,
	"NTNB":  returnKindInflation,
	"NTNBP": returnKindInflation,
	"NTNC":  returnKindInflation,
	"RENDA": returnKindInflation,
	"EDUCA": returnKindInflation,
}

// ContractFacts are the return kind, maturity and liquidity of a fixed income security
// (contribution rules GR3); Sovereign is true when they come from a government bond code (GR4).
type ContractFacts struct {
	ReturnKind     string // "rate", "inflation" or "fixed"
	MaturesOn      time.Time
	DailyLiquidity bool
	Sovereign      bool
}

// ContractFacts returns the facts of code from its terms, else from its government bond code;
// ErrNoTerms when it has neither.
func (m *Module) ContractFacts(ctx context.Context, code string) (ContractFacts, error) {
	t, err := m.Terms(ctx, code)
	if err == nil {
		return ContractFacts{
			ReturnKind:     m.termsReturnKind(t),
			MaturesOn:      t.MaturesOn,
			DailyLiquidity: t.DailyLiquidity,
		}, nil
	}

	if !errors.Is(err, ErrNoTerms) {
		return ContractFacts{}, err
	}

	match := governmentBondCode.FindStringSubmatch(code)
	if match == nil {
		return ContractFacts{}, ErrNoTerms
	}

	maturity, err := time.Parse("20060102", match[2])
	if err != nil {
		return ContractFacts{}, ErrNoTerms
	}

	return ContractFacts{
		ReturnKind:     governmentBondReturnKind[match[1]],
		MaturesOn:      maturity,
		DailyLiquidity: match[1] == "LFT",
		Sovereign:      true,
	}, nil
}

// governmentBondCoupons are the payments of one unit of a Brazilian government bond read from its
// code (coverage rows T-03, T-05), each on the next banking day; nil when code is not one. An NTN-F,
// an NTN-B and an NTN-C pay interest every 6 months back from maturity; an LTN and an NTN-F pay
// 1,000.00 at maturity; an RendA+ and an Educa+ return their principal in monthly payments ending
// on the maturity, each one part in the payments left of the units held. The payments of an LFT,
// an NTN-B Principal, an NTN-B, an NTN-C, an RendA+ and an Educa+ are their VNA (bond_vna.go): a
// coupon is the VNA times the interest factor, the principal the VNA; a payment whose VNA counts
// an index not yet stored carries no amount.
func (m *Module) governmentBondCoupons(ctx context.Context, code string) ([]Coupon, error) {
	match := governmentBondCode.FindStringSubmatch(code)
	if match == nil {
		return nil, nil
	}

	maturity, err := time.Parse("20060102", match[2])
	if err != nil {
		return nil, nil
	}

	kind := match[1]
	vna := &vnaReader{m: m}

	if n, ok := monthlyPayments[kind]; ok {
		return m.monthlyBondCoupons(ctx, vna, kind, maturity, n)
	}

	halfYearly := kind == "NTNF" || kind == "NTNB" || kind == "NTNC"
	known := kind == "LTN" || kind == "NTNF"

	payOn := bondPayDates(maturity, halfYearly)
	out := make([]Coupon, len(payOn))
	for i, d := range payOn {
		c := domain.Coupon{PaysOn: d, PaysInterest: halfYearly, RateMissing: !known}
		if c.Date, err = m.Adjust(ctx, CalendarBRBanking, d, AdjustFollowing); err != nil {
			return nil, err
		}

		if known && halfYearly {
			c.Interest = ntnfCoupon
		}

		if known && d.Equal(maturity) {
			c.Principal = bondFace
		}

		if err := withVNA(ctx, vna, &c, kind, maturity); err != nil {
			return nil, err
		}

		out[i] = c
	}

	return out, nil
}

// bondPayDates are the days a bond maturing on maturity pays: every 6 months back from it, for
// bondHistoryYears, when halfYearly; the maturity alone otherwise.
func bondPayDates(maturity time.Time, halfYearly bool) []time.Time {
	if !halfYearly {
		return []time.Time{maturity}
	}

	var out []time.Time

	first := maturity.AddDate(-bondHistoryYears, 0, 0)
	for d := maturity; d.After(first); d = d.AddDate(0, -6, 0) {
		out = append([]time.Time{d}, out...)
	}

	return out
}

// monthlyBondCoupons are n monthly payments of the principal ending on maturity: payment i
// amortizes one part in n − i of the units held, each unit at its VNA.
func (m *Module) monthlyBondCoupons(
	ctx context.Context,
	vna *vnaReader,
	kind string,
	maturity time.Time,
	n int,
) ([]Coupon, error) {
	out := make([]Coupon, n)
	for i := range out {
		c := domain.Coupon{
			PaysOn:        maturity.AddDate(0, i-n+1, 0),
			AmortizeOneOf: n - i,
			RateMissing:   true,
		}

		var err error
		if c.Date, err = m.Adjust(ctx, CalendarBRBanking, c.PaysOn, AdjustFollowing); err != nil {
			return nil, err
		}

		if err := withVNA(ctx, vna, &c, kind, maturity); err != nil {
			return nil, err
		}

		out[i] = c
	}

	return out, nil
}

// termsReturnKind is fixed without an index, inflation when the period of the index is a month and
// rate otherwise, including an index with no registered source.
func (m *Module) termsReturnKind(t Terms) string {
	if t.IndexID == "" {
		return returnKindFixed
	}

	for _, src := range m.feeds.Indexes {
		if src.Index() == t.IndexID && src.Period() == index.PeriodMonth {
			return returnKindInflation
		}
	}

	return returnKindRate
}

// bondIndex is the index that updates the nominal value of a kind of Brazilian government bond
// from 1,000.00 on its base; daily marks an index of business days, else the VNA of a payment counts
// the months from the base to the month before it.
type bondIndex struct {
	index string
	daily bool
}

// vnaBase is the first month the VNA counts: July 2000, the base of 2000-07-15 of the IPCA bonds
// and of 2000-07-01 of the IGP-M and Selic bonds (Tesouro Nacional, Metodologia de Cálculo dos
// Títulos Públicos Federais, version of 2024-04-29, read 2026-11-19; Tesouro Direto, NTN-B1).
var vnaBase = time.Date(2000, time.July, 1, 0, 0, 0, 0, time.UTC)

// brBondIndexes are the bonds whose nominal value an index updates (coverage rows T-01, T-04, T-05
// to T-08).
var brBondIndexes = map[string]bondIndex{
	"NTNB":  {index: "ipca"},
	"NTNBP": {index: "ipca"},
	"RENDA": {index: "ipca"},
	"EDUCA": {index: "ipca"},
	"NTNC":  {index: "igpm"},
	"LFT":   {index: "selic", daily: true},
}

// brBondInterest is the interest factor of a half year: 1.06^½ − 1 rounded to 8 decimals for an
// NTN-B and an NTN-C, and 1.12^½ − 1 for the NTN-C of 2031-01-01 (the same methodology).
const (
	brBondInterest     = "0.02956301"
	brBondInterest2031 = "0.05830052"
)

// interestFactor is the interest factor of the half-yearly coupon of kind maturing on maturity.
func interestFactor(kind string, maturity time.Time) string {
	if kind == "NTNC" && maturity.Equal(time.Date(2031, time.January, 1, 0, 0, 0, 0, time.UTC)) {
		return brBondInterest2031
	}

	return brBondInterest
}

// withVNA sets the amounts of c, a payment of kind maturing on maturity, from the VNA of its day:
// a half-yearly coupon pays the VNA times the interest factor, a payment of principal the VNA. A
// kind without an index or a VNA not yet known leaves c as it is.
func withVNA(
	ctx context.Context,
	r *vnaReader,
	c *domain.Coupon,
	kind string,
	maturity time.Time,
) error {
	v, ok, err := r.on(ctx, kind, c.PaysOn)
	if err != nil || !ok {
		return err
	}

	if c.PaysInterest {
		if c.Interest, err = domain.BondInterest(v, interestFactor(kind, maturity)); err != nil {
			return err
		}
	}

	if c.PaysOn.Equal(maturity) || c.AmortizeOneOf > 0 {
		c.Principal = v
	}

	c.RateMissing = false

	return nil
}

// vnaReader reads the rates of the indexes of the bonds once per call.
type vnaReader struct {
	m     *Module
	rates map[string][]domain.IndexRate
}

// on is the VNA of kind on date d with 12 decimals; false when the index of a month or a day it
// counts is not stored, so the payment carries no amount (investments design, amendment of
// 2026-10-26: no estimate of an unpublished period).
func (r *vnaReader) on(ctx context.Context, kind string, d time.Time) (string, bool, error) {
	bi, ok := brBondIndexes[kind]
	if !ok {
		return "", false, nil
	}

	rows, err := r.read(ctx, bi.index)
	if err != nil {
		return "", false, err
	}

	var rates []string

	if bi.daily {
		rates, ok, err = r.daily(ctx, rows, d)
	} else {
		rates, ok = domain.MonthlyRates(rows, vnaBase, d)
	}

	if err != nil || !ok {
		return "", false, err
	}

	vna, err := domain.VNA(rates)

	return vna, err == nil, err
}

func (r *vnaReader) read(ctx context.Context, idx string) ([]domain.IndexRate, error) {
	if rates, ok := r.rates[idx]; ok {
		return rates, nil
	}

	rows, err := r.m.q.ListIndexRates(
		ctx,
		postgres.ListIndexRatesParams{IndexID: idx, FromDate: vnaBase},
	)
	if err != nil {
		return nil, err
	}

	rates := make([]domain.IndexRate, len(rows))
	for i, row := range rows {
		v, err := row.Rate.Value()
		if err != nil {
			return nil, fmt.Errorf("rate of %s: %w", row.Date.Format(time.DateOnly), err)
		}

		rates[i] = domain.IndexRate{Date: row.Date, Rate: fmt.Sprint(v)}
	}

	if r.rates == nil {
		r.rates = map[string][]domain.IndexRate{}
	}

	r.rates[idx] = rates

	return rates, nil
}

// daily are the rates of the business days from vnaBase to the day before d; false when the rate
// of the business day before d is not stored.
func (r *vnaReader) daily(
	ctx context.Context,
	rows []domain.IndexRate,
	d time.Time,
) ([]string, bool, error) {
	last, err := r.m.Adjust(ctx, CalendarBRBanking, d.AddDate(0, 0, -1), AdjustPreceding)
	if err != nil {
		return nil, false, err
	}

	var out []string

	reached := false

	for _, row := range rows {
		if !row.Date.Before(d) {
			break
		}

		out = append(out, row.Rate)
		reached = reached || row.Date.Equal(last)
	}

	return out, reached, nil
}
