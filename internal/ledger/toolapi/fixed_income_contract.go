package toolapi

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// wholeIndexBP is a contract that pays its index, no more and no less.
const wholeIndexBP = 10000

var percentPattern = regexp.MustCompile(`^(-?)(\d{1,4})(?:\.(\d+))?$`)

func fixedIncomeContract(in recordFixedIncomeIn) (app.Contract, error) {
	c := app.Contract{
		Subtype:        in.Subtype,
		IssuerName:     in.Issuer,
		IssuerScheme:   in.IssuerScheme,
		IssuerID:       in.IssuerID,
		Name:           in.Name,
		IssuedOn:       in.IssuedOn.Time,
		MaturesOn:      in.MaturesOn.Time,
		IndexID:        in.IndexID,
		DayCount:       in.DayCount,
		CalendarID:     in.CalendarID,
		DailyLiquidity: in.DailyLiquidity,
		RedeemableFrom: in.RedeemableFrom.Time,

		InterestEveryMonths: in.InterestEveryMonths,
		FirstPaymentOn:      in.FirstPaymentOn.Time,
	}

	if c.Name == "" {
		c.Name = fmt.Sprintf(
			"%s %s %s", strings.ToUpper(in.Subtype), in.Issuer, in.MaturesOn.Format("2006-01-02"),
		)
	}

	var err error
	if c.PercentOfIndexBP, err = percentToBP("percent_of_index", in.PercentOfIndex); err != nil {
		return c, err
	}

	if c.SpreadBP, err = percentToBP("spread", in.Spread); err != nil {
		return c, err
	}

	c.Payments, err = amortizationPayments(in.Amortizations)

	return c, err
}

// amortizationPayments reads each amortization as a payment row that pays no interest.
func amortizationPayments(in []fixedIncomeAmortization) ([]app.Payment, error) {
	var out []app.Payment

	for i, a := range in {
		bp, err := percentToBP(fmt.Sprintf("amortizations[%d].percent", i), a.Percent)
		if err != nil {
			return nil, err
		}

		out = append(out, app.Payment{PaysOn: a.PaysOn.Time, AmortizationBP: bp})
	}

	return out, nil
}

// percentToBP converts percent text ("110", "6.5") to basis points; empty is 0.
func percentToBP(field, s string) (int, error) {
	if s == "" {
		return 0, nil
	}

	m := percentPattern.FindStringSubmatch(s)
	if m == nil {
		return 0, tool.InvalidArgument(field, "must be a percent such as 110 or 6.5")
	}

	if len(m[3]) > 2 {
		return 0, tool.InvalidArgument(field, "must have at most 2 decimals")
	}

	whole, _ := strconv.Atoi(m[2])
	frac, _ := strconv.Atoi((m[3] + "00")[:2])
	bp := whole*100 + frac

	if m[1] == "-" {
		bp = -bp
	}

	return bp, nil
}

// describeContract names a new contract and states its rate as values: the client writes the
// words (investment proposals design, IP7).
func describeContract(pv *tool.Preview, c app.Contract) {
	pv.Target = c.Name

	if c.PercentOfIndexBP != 0 && c.PercentOfIndexBP != wholeIndexBP {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "rate", After: tool.TextValue(percentText(c.PercentOfIndexBP))},
		)
	}

	if c.IndexID != "" {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "index", After: tool.TextValue(c.IndexID)},
		)
	}

	if c.SpreadBP != 0 {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "spread", After: tool.TextValue(percentText(c.SpreadBP))},
		)
	}

	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "maturity", After: tool.DateValue(c.MaturesOn)},
	)
}

func percentText(bp int) string {
	s := fmt.Sprintf("%d.%02d", bp/100, bp%100)

	return strings.TrimSuffix(strings.TrimRight(s, "0"), ".")
}
