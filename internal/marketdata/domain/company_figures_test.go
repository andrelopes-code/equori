package domain

import (
	"math/big"
	"testing"
	"time"
)

const thousand = 1000

// companyX is the company of the hand-computed cases of AC17.
func companyX() CompanyReport {
	return CompanyReport{
		Plan:          "standard",
		Currency:      "BRL",
		SharesPerUnit: whole(1),
		ShareCounts:   map[int]int64{2026: 1010000},
		Periods: []CompanyReportPeriod{
			{
				Period: on("2026-09-30"), Months: 9,
				TotalAssets: acc(120000), CurrentAssets: acc(45000),
				CurrentLiabilities: acc(30000), ShortDebt: acc(5000), LongDebt: acc(20000),
				Cash: acc(4000), ShortInvestments: acc(1000), Equity: acc(50000),
				EquityMinority: acc(4000), Revenue: acc(90000), GrossProfit: acc(36000),
				NetIncome: acc(9000), NetIncomeParent: acc(9000),
				SharesIssued: raw(1010), SharesTreasury: raw(10),
			},
			{
				Period: on("2025-12-31"), Months: 12,
				Equity: acc(45000), EquityMinority: acc(4000), Revenue: acc(100000),
				GrossProfit: acc(40000), NetIncome: acc(10000), NetIncomeParent: acc(10000),
			},
			{
				Period: on("2025-09-30"), Months: 9,
				Equity: acc(44000), EquityMinority: acc(4000), Revenue: acc(75000),
				GrossProfit: acc(30000), NetIncome: acc(7500), NetIncomeParent: acc(7500),
			},
		},
	}
}

func inputX() FigureInput {
	return FigureInput{
		Report:       companyX(),
		Today:        on("2026-11-23"),
		PriceDate:    on("2026-10-30"),
		MinorPerUnit: 100,
		Prices: []CompanyPrice{
			{Date: on("2026-09-30"), Value: dec("1.10")},
			{Date: on("2026-10-30"), Value: dec("1.15")},
		},
	}
}

func TestCompanyFigures(t *testing.T) {
	t.Parallel()

	got := Figures(inputX())

	for name, tc := range map[string]struct {
		got  Figure
		want string
		date string
	}{
		"price over earnings":   {got.PriceEarnings, "10", "2026-09-30"},
		"price over book":       {got.PriceBook, "2.5", "2026-09-30"},
		"return on equity":      {got.ReturnOnEquity, "0.23", "2026-09-30"},
		"net margin":            {got.NetMargin, "0.1", "2026-09-30"},
		"net debt over equity":  {got.NetDebtToEquity, "0.4", "2026-09-30"},
		"gross profit / assets": {got.GrossProfitToAssets, "0.383333", "2026-09-30"},
		"current ratio":         {got.CurrentRatio, "1.5", "2026-09-30"},
	} {
		if tc.got.Value == nil {
			t.Errorf("%s: no value, reason %q", name, tc.got.Reason)
			continue
		}

		if v := FigureText(tc.got.Value); v != tc.want || !tc.got.Date.Equal(on(tc.date)) {
			t.Errorf("%s = %s on %s, want %s on %s", name, v,
				tc.got.Date.Format(time.DateOnly), tc.want, tc.date)
		}
	}

	if got.PriceDate == nil || !got.PriceDate.Equal(on("2026-10-30")) {
		t.Errorf("price date = %v, want 2026-10-30", got.PriceDate)
	}

	assertChange(t, "profit", got.Profit, ChangeRate, "0.2", "2026-09-30", 9)
	assertChange(t, "revenue", got.Revenue, ChangeRate, "0.2", "2026-09-30", 9)
}

func TestCompanyMultiples(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		change func(*FigureInput)
		pe     string
		pb     string
		reason string
	}{
		"unit of five shares": {
			change: func(in *FigureInput) {
				in.Report.SharesPerUnit = whole(5)
				in.Prices[1].Value = dec("5.75")
				in.Prices[0].Value = dec("5.50")
			},
			pe: "10", pb: "2.5",
		},
		"composition unknown": {
			change: func(in *FigureInput) { in.Report.SharesPerUnit = nil },
			reason: "unit",
		},
		"count of another size": {
			change: func(in *FigureInput) { in.Report.ShareCounts[2026] = 1200000 },
			reason: "shares",
		},
		"count at the lower bound": {
			change: func(in *FigureInput) { in.Report.ShareCounts[2026] = 909000 },
			pe:     "10", pb: "2.5",
		},
		"count below the lower bound": {
			change: func(in *FigureInput) { in.Report.ShareCounts[2026] = 908999 },
			reason: "shares",
		},
		"count of the next year": {
			change: func(in *FigureInput) {
				in.Report.ShareCounts = map[int]int64{2027: 1010000}
			},
			pe: "10", pb: "2.5",
		},
		"no count": {
			change: func(in *FigureInput) { in.Report.ShareCounts = nil },
			reason: "shares",
		},
		"count in units": {
			change: func(in *FigureInput) {
				in.Report.ShareCounts[2026] = 1010
				in.Prices[0].Value, in.Prices[1].Value = dec("1100"), dec("1150")
			},
			pe: "10", pb: "2.5",
		},
		"filed shares already net of the treasury": {
			change: func(in *FigureInput) {
				in.Report.Periods[0].SharesIssued = raw(1000)
				in.Report.Periods[0].SharesTreasury = raw(50)
				in.Report.ShareCounts[2026] = 1050000
			},
			pe: "10", pb: "2.5",
		},
		"count halfway to the sum": {
			change: func(in *FigureInput) {
				in.Report.Periods[0].SharesIssued = raw(1050)
				in.Report.Periods[0].SharesTreasury = raw(50)
				in.Report.ShareCounts[2026] = 1075000
			},
			pe: "10", pb: "2.5",
		},
		"treasury holds every share": {
			change: func(in *FigureInput) {
				in.Report.Periods[0].SharesTreasury = raw(1010)
			},
			reason: "shares",
		},
		"classes differ": {
			change: func(in *FigureInput) { in.Report.Periods[0].ClassesDiffer = true },
			reason: "classes",
		},
		"price eleven days old": {
			change: func(in *FigureInput) { in.Prices[1].Date = on("2026-10-19") },
			reason: "no_price",
		},
		"price ten days old": {
			change: func(in *FigureInput) { in.Prices[1].Date = on("2026-10-20") },
			pe:     "10", pb: "2.5",
		},
		"no price": {
			change: func(in *FigureInput) { in.Prices = nil },
			reason: "no_price",
		},
		"jump down": {
			change: func(in *FigureInput) {
				in.Prices = []CompanyPrice{
					{Date: on("2026-10-05"), Value: dec("1.15")},
					{Date: on("2026-10-06"), Value: dec("0.57")},
					{Date: on("2026-10-30"), Value: dec("0.60")},
				}
			},
			reason: "price_jump",
		},
		"jump up": {
			change: func(in *FigureInput) { in.Prices[0].Value = dec("0.638") },
			reason: "price_jump",
		},
		"rise below the jump": {
			change: func(in *FigureInput) { in.Prices[0].Value = dec("0.639") },
			pe:     "10", pb: "2.5",
		},
		"jump before the balance": {
			change: func(in *FigureInput) {
				in.Prices = append([]CompanyPrice{
					{Date: on("2026-09-29"), Value: dec("5")},
				}, in.Prices...)
			},
			pe: "10", pb: "2.5",
		},
		"balance of 201 days": {
			change: func(in *FigureInput) {
				in.PriceDate = on("2027-04-19")
				in.Prices[1].Date = on("2027-04-19")
			},
			reason: "stale",
		},
		"balance of 200 days": {
			change: func(in *FigureInput) {
				in.PriceDate = on("2027-04-18")
				in.Prices[1].Date = on("2027-04-18")
			},
			pe: "10", pb: "2.5",
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			in := inputX()
			tc.change(&in)

			got := Figures(in)
			assertFigure(t, "price over earnings", got.PriceEarnings, tc.pe, tc.reason)
			assertFigure(t, "price over book", got.PriceBook, tc.pb, tc.reason)
		})
	}
}

func TestCompanyEarnings(t *testing.T) {
	t.Parallel()

	sixMonths := func(in *FigureInput) {
		in.Report.Periods = append(in.Report.Periods,
			CompanyReportPeriod{
				Period: on("2026-06-30"), Months: 6, Equity: acc(50000),
				EquityMinority: acc(4000), NetIncome: acc(6100), NetIncomeParent: acc(6000),
			},
			CompanyReportPeriod{
				Period: on("2025-06-30"), Months: 6, Equity: acc(44000),
				EquityMinority: acc(4000), NetIncome: acc(5100), NetIncomeParent: acc(5000),
			})
	}

	for name, tc := range map[string]struct {
		change func(*FigureInput)
		want   string
		reason string
		date   string
	}{
		"parent missing, minority above 1%": {
			change: func(in *FigureInput) { in.Report.Periods[0].NetIncomeParent = nil },
			reason: "parent_income",
		},
		"parent zero, the half year is read": {
			change: func(in *FigureInput) {
				in.Report.Periods[0].NetIncomeParent = acc(0)

				sixMonths(in)
			},
			want: "10.454545", date: "2026-06-30",
		},
		"parent missing, minority at most 1%": {
			change: func(in *FigureInput) {
				for i := range in.Report.Periods {
					in.Report.Periods[i].NetIncomeParent = nil
					in.Report.Periods[i].EquityMinority = acc(400)
				}
			},
			want: "10", date: "2026-09-30",
		},
		"individual statements": {
			change: func(in *FigureInput) {
				for i := range in.Report.Periods {
					in.Report.Periods[i].NetIncomeParent = nil
					in.Report.Periods[i].EquityMinority = nil
				}
			},
			want: "10", date: "2026-09-30",
		},
		"loss": {
			change: func(in *FigureInput) {
				in.Report.Periods[0].NetIncomeParent = raw(-2500*thousand - 1)
			},
			reason: "loss",
		},
		"income missing": {
			change: func(in *FigureInput) {
				in.Report.Periods[2].NetIncome = nil
				in.Report.Periods[2].NetIncomeParent = nil
			},
			reason: "missing",
		},
		"fiscal year alone": {
			change: func(in *FigureInput) {
				fy := in.Report.Periods[1]
				fy.Period = on("2026-06-30")
				fy.SharesIssued, fy.SharesTreasury = raw(1010), raw(10)
				in.Report.Periods = []CompanyReportPeriod{fy}
				in.Prices[0].Date = on("2026-07-01")
			},
			want: "11.5", date: "2026-06-30",
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			in := inputX()
			tc.change(&in)

			got := Figures(in).PriceEarnings
			assertFigure(t, "price over earnings", got, tc.want, tc.reason)

			if tc.want != "" && !got.Date.Equal(on(tc.date)) {
				t.Errorf("date = %s, want %s", got.Date.Format(time.DateOnly), tc.date)
			}
		})
	}
}

func TestCompanyRatios(t *testing.T) {
	t.Parallel()

	in := inputX()
	in.Report.Periods[0].Equity = acc(4000)

	got := Figures(in)
	assertFigure(t, "price over book", got.PriceBook, "", "negative_equity")
	assertFigure(t, "return on equity", got.ReturnOnEquity, "2.875", "")

	in.Report.Periods[0].Equity = acc(0)
	got = Figures(in)
	assertFigure(t, "return on equity, no equity", got.ReturnOnEquity, "", "negative_equity")
	assertFigure(t, "net debt, no equity", got.NetDebtToEquity, "", "negative_equity")

	in = inputX()
	in.Report.Plan = "other"
	got = Figures(in)
	assertFigure(t, "return on equity, other chart", got.ReturnOnEquity, "0.23", "")
	assertFigure(t, "net margin, other chart", got.NetMargin, "", "chart")
	assertFigure(t, "current ratio, other chart", got.CurrentRatio, "", "chart")
	assertFigure(t, "growth, other chart", got.RevenueGrowth, "", "chart")

	in = inputX()
	in.Report.Periods[0].CurrentAssets = nil
	assertFigure(t, "current ratio, missing", Figures(in).CurrentRatio, "", "missing")

	in = inputX()
	in.Today = on("2027-04-19")
	assertFigure(t, "return on equity, stale", Figures(in).ReturnOnEquity, "", "stale")

	none := Figures(FigureInput{Report: CompanyReport{Plan: "standard"}})
	assertFigure(t, "no period", none.ReturnOnEquity, "", "missing")
}

func TestCompanyHistory(t *testing.T) {
	t.Parallel()

	in := inputX()
	in.Report.Periods = fiscalYears(64000, 70000, 80000, 90000, 100000)

	got := Figures(in)
	assertFigure(t, "growth", got.RevenueGrowth, "0.118034", "")

	if got.Growth.Years != 4 || *got.Growth.First != 64000*thousand {
		t.Errorf("growth terms = %+v, want 4 years from 64,000k", got.Growth)
	}

	in.Report.Periods = fiscalYears(64000, 70000, 80000)
	assertFigure(t, "three years", Figures(in).RevenueGrowth, "", "short_history")

	in.Report.Periods = fiscalYears(0, 70000, 80000, 90000)
	assertFigure(t, "no revenue", Figures(in).RevenueGrowth, "", "missing")

	// The sixth year, the oldest, is not read.
	in.Report.Periods = fiscalYears(1, 64000, 70000, 80000, 90000, 100000)
	assertFigure(t, "six years", Figures(in).RevenueGrowth, "0.118034", "")

	years := fiscalYears(1, 2, 3, 4, 5)
	for i, income := range []int64{7, 0, 3, -5, 10} {
		years[i].NetIncome = acc(income)
	}

	in.Report.Periods = years
	if p := Figures(in).PositiveYears; p.Positive != 3 || p.Years != 5 {
		t.Errorf("positive years = %+v, want 3 of 5", p)
	}
}

func TestCompanyChange(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		now, before int64
		state, rate string
	}{
		"fall":                     {6150, 7500, ChangeRate, "-0.18"},
		"loss":                     {-1, 7500, ChangeLoss, ""},
		"zero":                     {0, 7500, ChangeLoss, ""},
		"turned":                   {1, 0, ChangeTurned, ""},
		"turned from a loss":       {1, -5, ChangeTurned, ""},
		"loss after a loss":        {-1, -5, ChangeLoss, ""},
		"rounded to six decimals":  {10000, 7500, ChangeRate, "0.333333"},
		"equal":                    {7500, 7500, ChangeRate, "0"},
		"rounded half away, three": {15001, 30000, ChangeRate, "-0.499967"},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			in := inputX()
			in.Report.Periods[0].NetIncome = acc(tc.now)
			in.Report.Periods[2].NetIncome = acc(tc.before)
			assertChange(t, "profit", Figures(in).Profit, tc.state, tc.rate, "2026-09-30", 9)
		})
	}

	in := inputX()
	in.Report.Periods = fiscalYears(100, 100)
	in.Report.Periods[0].NetIncome = acc(12)
	in.Report.Periods[1].NetIncome = acc(10)
	assertChange(t, "fiscal years", Figures(in).Profit, ChangeRate, "0.2",
		"2025-12-31", 12)

	in.Report.Periods = in.Report.Periods[:1]
	if got := Figures(in).Profit; got.State != "" || got.Reason != "short_history" {
		t.Errorf("one year = %+v, want short_history", got)
	}
}

func TestCompanyRange(t *testing.T) {
	t.Parallel()

	// One million shares: an income of 1,000k minor units is 0.01 a share, so a price of 0.08 is 8.
	in := inputX()
	in.Report.ShareCounts = map[int]int64{}
	in.Report.Periods = fiscalYears(1, 1, 1, 1, 1)
	in.YearPrices = map[time.Time]*big.Rat{}

	for i, tc := range []struct {
		price  string
		income int64
	}{{"0.09", 1000}, {"0.50", -1}, {"0.10", 1000}, {"0.12", 1000}, {"0.08", 1000}} {
		p := &in.Report.Periods[i]
		p.NetIncome, p.NetIncomeParent = acc(tc.income), acc(tc.income)
		p.Equity, p.SharesIssued, p.SharesTreasury = acc(2000), raw(1000000), raw(0)
		in.Report.ShareCounts[p.Period.Year()] = 1000000
		in.YearPrices[p.Period] = dec(tc.price)
	}

	got := Figures(in)
	assertRange(t, "price over earnings", got.PriceEarningsRange, "8", "12", 4)
	assertRange(t, "price over book", got.PriceBookRange, "4", "25", 5)

	delete(in.YearPrices, on("2025-12-31"))
	assertRange(t, "a year without price", Figures(in).PriceEarningsRange, "8", "12", 3)

	delete(in.YearPrices, on("2021-12-31"))

	if r := Figures(in).PriceEarningsRange; r != nil {
		t.Errorf("two years = %+v, want none", r)
	}
}

// fiscalYears returns one fiscal year per revenue, the arguments oldest first, newest first.
func fiscalYears(revenues ...int64) []CompanyReportPeriod {
	out := make([]CompanyReportPeriod, len(revenues))

	for i, r := range revenues {
		end := time.Date(2026-len(revenues)+i, time.December, 31, 0, 0, 0, 0, time.UTC)
		out[len(revenues)-1-i] = CompanyReportPeriod{
			Period: end, Months: 12, Revenue: acc(r),
		}
	}

	return out
}

func assertFigure(t *testing.T, name string, got Figure, value, reason string) {
	t.Helper()

	text := ""
	if got.Value != nil {
		text = FigureText(got.Value)
	}

	if text != value || got.Reason != reason {
		t.Errorf("%s = %q reason %q, want %q reason %q", name, text, got.Reason, value, reason)
	}
}

func assertChange(
	t *testing.T,
	name string,
	got Change,
	state, rate, date string,
	months int,
) {
	t.Helper()

	text := ""
	if got.Rate != nil {
		text = FigureText(got.Rate)
	}

	if got.State != state || text != rate || !got.Date.Equal(on(date)) || got.Months != months {
		t.Errorf("%s = %+v (%s), want %s %q on %s over %d months", name, got, text, state, rate,
			date, months)
	}
}

func assertRange(t *testing.T, name string, got *Range, least, greatest string, years int) {
	t.Helper()

	if got == nil {
		t.Errorf("%s: no range", name)
		return
	}

	l, g := FigureText(got.Least), FigureText(got.Greatest)
	if l != least || g != greatest || got.Years != years {
		t.Errorf("%s = %s to %s in %d years, want %s to %s in %d", name, l, g, got.Years, least,
			greatest, years)
	}
}

func on(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}

func dec(s string) *big.Rat {
	r, ok := new(big.Rat).SetString(s)
	if !ok {
		panic(s)
	}

	return r
}

// acc is an account of n thousand minor units.
func acc(n int64) *int64 { return raw(n * thousand) }

func raw(n int64) *int64 { return &n }

func whole(n int) *int { return &n }
