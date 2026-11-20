package main

import "testing"

func TestCorporateActionAdjustsHolding(t *testing.T) {
	for _, tc := range []struct {
		name   string
		quoted bool
		buy    int64
		action corporateAction
		want   int64
	}{
		{
			name:   "a bonus of 10 percent rounds the units down",
			quoted: true,
			buy:    105,
			action: corporateAction{"ITUB4", "2026-03-18", "bonus", 10, 11},
			want:   115,
		},
		{
			name:   "a split multiplies the units",
			quoted: true,
			buy:    40,
			action: corporateAction{"ITUB4", "2026-03-18", "split", 1, 5},
			want:   200,
		},
		{
			name:   "a security without a held unit records nothing",
			quoted: true,
			action: corporateAction{"ITUB4", "2026-03-18", "split", 1, 5},
		},
		{
			// A synthetic walk has no event in it: the action would cut the value of the holding.
			name:   "a security priced by the synthetic walk records nothing",
			buy:    40,
			action: corporateAction{"ITUB4", "2026-03-18", "split", 1, 5},
			want:   40,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := investmentsHarness(t)
			if tc.quoted {
				recordPrice(s, "ITUB4", "2026-01-02", "40.00")
			}

			s.loadPrices()

			if tc.buy > 0 {
				s.depositBeforeRecords(day("2026-02-02"), 1000000)
				s.trade(day("2026-02-02"), "ITUB4", "buy", tc.buy, 40)
			}

			s.applyCorporateAction(tc.action)

			if s.err != nil {
				t.Fatal(s.err)
			}

			if s.hold["ITUB4"] != tc.want {
				t.Errorf("units held = %d, want %d", s.hold["ITUB4"], tc.want)
			}

			if got := s.balanceOn(s.security("ITUB4").key(), "2026-03-18"); got != tc.want {
				t.Errorf("units in the books = %d, want %d", got, tc.want)
			}
		})
	}
}
