package domain

import (
	"maps"
	"testing"
	"time"
)

func date(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}

func cdiWeek(skip ...string) []IndexRate {
	var rates []IndexRate
	for _, d := range []string{"2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"} {
		if !contains(skip, d) {
			rates = append(rates, IndexRate{Date: date(d), Rate: "0.000551310000"})
		}
	}

	return rates
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}

	return false
}

func values(prices []DatedPrice) map[string]string {
	out := map[string]string{}
	for _, p := range prices {
		out[p.Date.Format(time.DateOnly)] = p.Value
	}

	return out
}

func cdb(percent, spread int) Terms {
	return Terms{
		IssuedOn: date(
			"2026-01-02",
		),
		MaturesOn:        date("2028-01-02"),
		IndexID:          "cdi",
		PercentOfIndexBP: percent,
		SpreadBP:         spread,
		DayCount:         DayCountBus252,
		FaceValue:        100000,
	}
}

// The expected prices were computed independently with 80-digit decimals and rounded half to even
// to 12 decimals.
func TestAccrueCDI(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		terms Terms
		rates []IndexRate
		want  map[string]string
	}{
		{
			"the plain index",
			cdb(10000, 0),
			cdiWeek(),
			map[string]string{
				"2026-01-02": "1000.000000000000",
				"2026-01-05": "1000.551310000000",
				"2026-01-06": "1001.102923942716",
				"2026-01-07": "1001.654841995715",
				"2026-01-08": "1002.207064326656",
				"2026-01-09": "1002.759591103290",
			},
		},
		{
			"110 per cent of the index",
			cdb(11000, 0),
			cdiWeek(),
			map[string]string{
				"2026-01-02": "1000.000000000000",
				"2026-01-05": "1000.606441000000",
				"2026-01-06": "1001.213249770686",
				"2026-01-07": "1001.820426535091",
				"2026-01-08": "1002.427971516379",
				"2026-01-09": "1003.035884937853",
			},
		},
		{
			"a spread over 252 business days",
			cdb(10000, 600),
			cdiWeek(),
			map[string]string{
				"2026-01-02": "1000.000000000000",
				"2026-01-05": "1000.782690052490",
				"2026-01-06": "1001.565992708698",
				"2026-01-07": "1002.349908448103",
				"2026-01-08": "1003.134437750560",
				"2026-01-09": "1003.919581096297",
			},
		},
		{
			"a day without a published rate is skipped, not invented",
			cdb(10000, 0),
			cdiWeek("2026-01-06"),
			map[string]string{
				"2026-01-02": "1000.000000000000",
				"2026-01-05": "1000.551310000000",
				"2026-01-07": "1001.102923942716",
				"2026-01-08": "1001.654841995715",
				"2026-01-09": "1002.207064326656",
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			prices, err := Accrue(
				tt.terms,
				BusinessDayIndexes{"cdi"},
				2,
				tt.rates,
				date("2026-01-01"),
				date("2026-01-09"),
				nil,
			)
			if err != nil {
				t.Fatal(err)
			}

			got := values(prices)
			for d, want := range tt.want {
				if got[d] != want {
					t.Errorf("price on %s = %q, want %q", d, got[d], want)
				}
			}

			if len(got) != len(tt.want) {
				t.Errorf("prices = %v", got)
			}
		})
	}
}

func TestAccruePreFixed(t *testing.T) {
	t.Parallel()

	terms := Terms{
		IssuedOn:  date("2026-01-01"),
		MaturesOn: date("2030-01-01"),
		SpreadBP:  600,
		DayCount:  DayCountAct365,
		FaceValue: 100000,
	}

	prices, err := Accrue(
		terms,
		BusinessDayIndexes{"cdi"},
		2,
		nil,
		date("2026-01-01"),
		date("2026-02-27"),
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}

	got := values(prices)
	// 42 weekdays from 2026-01-01 to 2026-02-27 (the weekends carry the previous price).
	if len(got) != 42 || got["2026-01-01"] != "1000.000000000000" ||
		got["2026-01-02"] != "1000.159653587453" ||
		got["2026-02-27"] != "1009.141054685796" {
		t.Fatalf(
			"prices = %d, %v %v %v",
			len(got),
			got["2026-01-01"],
			got["2026-01-02"],
			got["2026-02-27"],
		)
	}

	if _, ok := got["2026-01-03"]; ok {
		t.Fatal("a Saturday has a price")
	}
}

func TestAccrueIPCAStep(t *testing.T) {
	t.Parallel()

	terms := Terms{
		IssuedOn:         date("2026-01-01"),
		MaturesOn:        date("2035-05-15"),
		IndexID:          "ipca",
		PercentOfIndexBP: 10000,
		SpreadBP:         600,
		DayCount:         DayCountAct365,
		FaceValue:        100000,
	}
	rates := []IndexRate{
		{Date: date("2026-01-01"), Rate: "0.004200000000"},
		{Date: date("2026-02-01"), Rate: "-0.003000000000"},
	}

	prices, err := Accrue(
		terms,
		BusinessDayIndexes{"cdi"},
		2,
		rates,
		date("2026-01-30"),
		date("2026-03-02"),
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}

	got := values(prices)
	// A month counts from the day after its last day; before that only the spread accrues.
	want := map[string]string{
		"2026-01-30": "1004.640317564163",
		"2026-02-02": "1009.343088309557",
		"2026-03-02": "1010.823298922241",
	}
	for d, v := range want {
		if got[d] != v {
			t.Errorf("price on %s = %q, want %q", d, got[d], v)
		}
	}
}

// Investments design, section 7, amendment of 2026-10-26: a month whose rate is not published
// adds no index growth and no estimate; only the spread accrues.
func TestAccrueIPCAWithoutPublishedMonth(t *testing.T) {
	t.Parallel()

	terms := Terms{
		IssuedOn:         date("2026-01-01"),
		MaturesOn:        date("2035-05-15"),
		IndexID:          "ipca",
		PercentOfIndexBP: 10000,
		SpreadBP:         600,
		DayCount:         DayCountAct365,
		FaceValue:        100000,
	}
	rates := []IndexRate{
		{Date: date("2026-01-01"), Rate: "0.004200000000"},
		{Date: date("2026-02-01"), Rate: "-0.003000000000"},
	}

	prices, err := Accrue(
		terms,
		BusinessDayIndexes{"cdi"},
		2,
		rates,
		date("2026-04-01"),
		date("2026-04-02"),
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}

	got := values(prices)
	// 1000 × 1.0042 × 0.997 × 1.06^(days/365): March has ended without a published rate.
	want := map[string]string{"2026-04-01": "1015.675970458164", "2026-04-02": "1015.838126770537"}
	for d, v := range want {
		if got[d] != v {
			t.Errorf("price on %s = %q, want %q", d, got[d], v)
		}
	}
}

func TestAccruePeriod(t *testing.T) {
	t.Parallel()

	terms := cdb(10000, 0)
	terms.MaturesOn = date("2026-01-07")

	prices, err := Accrue(
		terms,
		BusinessDayIndexes{"cdi"},
		2,
		cdiWeek(),
		date("2026-01-01"),
		date("2026-01-09"),
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}

	if got := values(prices); len(got) != 4 || got["2026-01-07"] == "" || got["2026-01-08"] != "" {
		t.Fatalf("prices after maturity: %v", got)
	}

	prices, err = Accrue(
		cdb(10000, 0),
		BusinessDayIndexes{"cdi"},
		2,
		cdiWeek(),
		date("2026-01-07"),
		date("2026-01-09"),
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}

	// Starting later changes nothing about the factor: it still counts from the issue date.
	if got := values(prices); len(got) != 3 || got["2026-01-07"] != "1001.654841995715" {
		t.Fatalf("prices from the 7th: %v", got)
	}

	prices, err = Accrue(
		cdb(10000, 0),
		BusinessDayIndexes{"cdi"},
		2,
		nil,
		date("2026-01-01"),
		date("2026-01-09"),
		nil,
	)
	if err != nil || len(prices) != 1 || prices[0].Value != "1000.000000000000" {
		t.Fatalf("prices without rates = %+v, %v", prices, err)
	}
}

// HR1: the accrued days after an observed price grow from it.
func TestAnchor(t *testing.T) {
	accrued := []DatedPrice{
		{Date: date("2026-01-02"), Value: "100"},
		{Date: date("2026-01-05"), Value: "110"},
		{Date: date("2026-01-06"), Value: "121"},
	}

	tests := []struct {
		name     string
		observed []DatedPrice
		want     map[string]string
	}{
		{
			name: "no observed price",
			want: map[string]string{"2026-01-02": "100", "2026-01-05": "110", "2026-01-06": "121"},
		},
		{
			name:     "observed before the first accrued day",
			observed: []DatedPrice{{Date: date("2026-01-01"), Value: "50"}},
			want: map[string]string{
				"2026-01-02": "100",
				"2026-01-05": "110",
				"2026-01-06": "121",
			},
		},
		{
			name:     "observed on a day without accrual",
			observed: []DatedPrice{{Date: date("2026-01-03"), Value: "200"}},
			want: map[string]string{
				"2026-01-02": "100",
				"2026-01-05": "220.000000000000",
				"2026-01-06": "242.000000000000",
			},
		},
		{
			name: "the latest observed price wins",
			observed: []DatedPrice{
				{Date: date("2026-01-03"), Value: "200"},
				{Date: date("2026-01-05"), Value: "300"},
			},
			want: map[string]string{
				"2026-01-02": "100",
				"2026-01-05": "300.000000000000",
				"2026-01-06": "330.000000000000",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Anchor(accrued, tt.observed)
			if err != nil {
				t.Fatal(err)
			}

			if g := values(got); !maps.Equal(g, tt.want) {
				t.Errorf("Anchor = %v, want %v", g, tt.want)
			}
		})
	}
}

// TestAccrueDailyIndexIgnoresCalendar is S468 (A236 FC5): an index that compounds by business
// day keeps its published days as the business days, whatever calendar the terms name.
func TestAccrueDailyIndexIgnoresCalendar(t *testing.T) {
	t.Parallel()

	terms := cdb(10000, 600)
	terms.CalendarID = "br_banking"
	noTuesday := func(d time.Time) bool { return d.Format(time.DateOnly) != "2026-01-06" }

	prices, err := Accrue(
		terms,
		BusinessDayIndexes{"cdi"},
		2,
		cdiWeek(),
		date("2026-01-02"),
		date("2026-01-09"),
		noTuesday,
	)
	if err != nil {
		t.Fatal(err)
	}

	got := values(prices)
	want := map[string]string{
		"2026-01-06": "1001.565992708698",
		"2026-01-09": "1003.919581096297",
	}

	for d, v := range want {
		if got[d] != v {
			t.Errorf("price on %s = %q, want %q", d, got[d], v)
		}
	}
}

func TestAccruePreFixedBusinessDays(t *testing.T) {
	t.Parallel()

	terms := Terms{
		IssuedOn: date("2026-01-02"), MaturesOn: date("2030-01-02"), SpreadBP: 1200,
		DayCount: DayCountBus252, CalendarID: "br_banking", FaceValue: 100000,
	}

	prices, err := Accrue(
		terms,
		BusinessDayIndexes{"cdi"},
		2,
		nil,
		date("2026-01-02"),
		date("2026-02-27"),
		carnivalClosed,
	)
	if err != nil {
		t.Fatal(err)
	}

	got := values(prices)
	want := map[string]string{
		"2026-01-02": "1000.000000000000",
		"2026-01-05": "1000.449818143039",
		"2026-01-30": "1009.034910724779",
		"2026-02-13": "1013.582931252300",
		"2026-02-16": "",
		"2026-02-17": "",
		"2026-02-18": "1014.038859244253",
		"2026-02-27": "1017.236102727987",
	}

	for d, v := range want {
		if got[d] != v {
			t.Errorf("price on %s = %q, want %q", d, got[d], v)
		}
	}
}

func TestAccrueIPCASpreadBusinessDays(t *testing.T) {
	t.Parallel()

	terms := Terms{
		IssuedOn: date("2026-02-01"), MaturesOn: date("2035-05-15"), IndexID: "ipca",
		PercentOfIndexBP: 10000, SpreadBP: 600, DayCount: DayCountBus252,
		CalendarID: "br_banking", FaceValue: 100000,
	}
	rates := []IndexRate{{Date: date("2026-02-01"), Rate: "0.003300000000"}}

	prices, err := Accrue(
		terms,
		BusinessDayIndexes{"cdi"},
		2,
		rates,
		date("2026-02-01"),
		date("2026-03-02"),
		carnivalClosed,
	)
	if err != nil {
		t.Fatal(err)
	}

	got := values(prices)
	want := map[string]string{
		"2026-02-27": "1004.170738286911",
		"2026-03-02": "1007.717485094087",
	}

	for d, v := range want {
		if got[d] != v {
			t.Errorf("price on %s = %q, want %q", d, got[d], v)
		}
	}
}

func TestAccrueCalendarWithoutBusinessDays(t *testing.T) {
	t.Parallel()

	terms := Terms{
		IssuedOn: date("2026-01-02"), MaturesOn: date("2030-01-02"), SpreadBP: 1200,
		DayCount: DayCountBus252, CalendarID: "br_banking", FaceValue: 100000,
	}

	_, err := Accrue(
		terms, BusinessDayIndexes{"cdi"}, 2, nil, date("2026-01-02"), date("2026-02-27"), nil,
	)
	if err == nil {
		t.Fatal("Accrue with a calendar and no predicate returned nil")
	}
}

// carnivalClosed is a weekday calendar closed on 2026-02-16 and 2026-02-17.
func carnivalClosed(d time.Time) bool {
	switch d.Format(time.DateOnly) {
	case "2026-02-16", "2026-02-17":
		return false
	}

	return d.Weekday() != time.Saturday && d.Weekday() != time.Sunday
}
