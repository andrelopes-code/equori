package marketdata

import (
	"context"
	"errors"
	"regexp"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/index"
)

const (
	// ntnfCoupon is what one NTN-F pays every 6 months: 1,000.00 × (1.10^½ − 1), the coupon of
	// 10% a year of the Metodologia de Cálculo dos Títulos Públicos Federais of the Tesouro.
	ntnfCoupon = "48.808848170152"
	// bondFace is the 1,000.00 an LTN and an NTN-F pay at maturity.
	bondFace = "1000.000000000000"
	// bondHistoryYears bounds the coupons listed before the maturity of a bond.
	bondHistoryYears = 40
	fullPrincipalBP  = 10000

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
// on the maturity, each the share of the basis points left that one payment of those left takes.
// The nominal value of an LFT, an NTN-B, an NTN-C, an RendA+ and an Educa+ is not published by the
// source, so their payments carry no amount.
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
	if n, ok := monthlyPayments[kind]; ok {
		return m.monthlyBondCoupons(ctx, maturity, n)
	}

	halfYearly := kind == "NTNF" || kind == "NTNB" || kind == "NTNC"
	known := kind == "LTN" || kind == "NTNF"

	var payOn []time.Time
	if halfYearly {
		first := maturity.AddDate(-bondHistoryYears, 0, 0)
		for d := maturity; d.After(first); d = d.AddDate(0, -6, 0) {
			payOn = append([]time.Time{d}, payOn...)
		}
	} else {
		payOn = []time.Time{maturity}
	}

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

		out[i] = c
	}

	return out, nil
}

// monthlyBondCoupons are n monthly payments of the principal ending on maturity, without amount;
// payment i amortizes floor(10000·(i+1)/n) − floor(10000·i/n) basis points, so they sum to 10000.
func (m *Module) monthlyBondCoupons(
	ctx context.Context,
	maturity time.Time,
	n int,
) ([]Coupon, error) {
	out := make([]Coupon, n)
	for i := range out {
		c := domain.Coupon{
			PaysOn:         maturity.AddDate(0, i-n+1, 0),
			AmortizationBP: fullPrincipalBP*(i+1)/n - fullPrincipalBP*i/n,
			RateMissing:    true,
		}

		var err error
		if c.Date, err = m.Adjust(ctx, CalendarBRBanking, c.PaysOn, AdjustFollowing); err != nil {
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
