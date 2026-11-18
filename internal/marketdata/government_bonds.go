package marketdata

import (
	"context"
	"regexp"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
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
)

// monthlyPayments are the monthly payments of the principal of a bond of income: 240 for an
// RendA+, 60 for an Educa+, the last on the maturity (coverage rows T-06, T-07).
var monthlyPayments = map[string]int{"RENDA": 240, "EDUCA": 60}

// governmentBondCode is the listing code of a Brazilian government bond of the tesouro_direto
// feed: its kind and its maturity as YYYYMMDD.
var governmentBondCode = regexp.MustCompile(
	`^(LFT|LTN|NTNF|NTNB|NTNBP|NTNC|RENDA|EDUCA)\.([0-9]{8})$`,
)

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
