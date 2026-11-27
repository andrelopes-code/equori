package domain

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestParseInvestmentFile(t *testing.T) {
	t.Parallel()

	header := strings.Join(investmentFileHeader, ",") + "\n"
	day := func(s string) time.Time {
		d, err := time.Parse(time.DateOnly, s)
		if err != nil {
			t.Fatal(err)
		}

		return d
	}

	tests := []struct {
		name      string
		content   string
		want      []FileLine
		wantField string
		wantMsg   string
	}{
		{
			name: "four kinds",
			content: header +
				"opening,2021-03-10,PETR4,100,20.00,5.00,,,,\n" +
				"sell,2026-11-10,PETR4,40,30.00,,0.06,,,\n" +
				"income,2026-11-14,HGLG11,,,,,11.00,0.50,distribution\n",
			want: []FileLine{
				{
					Line: 2, Kind: "opening", Date: day("2021-03-10"), Instrument: "PETR4",
					Quantity: "100", UnitPrice: "20.00", Fees: "5.00",
				},
				{
					Line: 3, Kind: "sell", Date: day("2026-11-10"), Instrument: "PETR4",
					Quantity: "40", UnitPrice: "30.00", Taxes: "0.06",
				},
				{
					Line: 4, Kind: "income", Date: day("2026-11-14"), Instrument: "HGLG11",
					Gross: "11.00", Withheld: "0.50", IncomeType: "distribution",
				},
			},
		},
		{
			name:      "wrong header",
			content:   "kind,date\nbuy,2026-01-01\n",
			wantField: "line 1",
			wantMsg: "must be the header " +
				"kind,date,instrument,quantity,unit_price,fees,taxes,gross,withheld,income_type",
		},
		{
			name:      "nine values",
			content:   header + "buy,2026-01-02,PETR4,1,2.00,,,,\n",
			wantField: "line 2",
			wantMsg:   "must have ten comma-separated values",
		},
		{
			name:      "unknown kind",
			content:   header + "dividend,2026-01-02,PETR4,,,,,1.00,,\n",
			wantField: "line 2",
			wantMsg:   "kind must be opening, buy, sell or income",
		},
		{
			name: "invalid date",
			content: header +
				"buy,2026-01-02,PETR4,1,2.00,,,,,\n" +
				"buy,2026-01-03,PETR4,1,2.00,,,,,\n" +
				"buy,2026-13-01,PETR4,1,2.00,,,,,\n",
			wantField: "line 4",
			wantMsg:   "date must be YYYY-MM-DD",
		},
		{
			name:      "header only",
			content:   header,
			wantField: "file",
			wantMsg:   "has no lines",
		},
		{
			name: "too many lines",
			content: header +
				strings.Repeat("buy,2026-01-02,PETR4,1,2.00,,,,,\n", MaxFileLines+1),
			wantField: "file",
			wantMsg:   "must have at most 10000 lines",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := ParseInvestmentFile([]byte(tc.content))
			if tc.wantField != "" {
				fe, ok := errors.AsType[*FieldError](err)
				if !ok || fe.Field != tc.wantField || fe.Message != tc.wantMsg {
					t.Fatalf("err = %v, want field %q message %q", err, tc.wantField, tc.wantMsg)
				}

				return
			}

			if err != nil {
				t.Fatal(err)
			}

			if len(got) != len(tc.want) {
				t.Fatalf("lines = %d, want %d", len(got), len(tc.want))
			}

			for i := range got {
				if got[i] != tc.want[i] {
					t.Errorf("line %d = %+v, want %+v", i, got[i], tc.want[i])
				}
			}
		})
	}
}
