package main

import (
	"net/http"
	"slices"
	"strings"
	"testing"
)

const buyPrefix = "Compra de "

// assertPortfolioHistory checks the portfolio of the persona: an investor who began ten years before
// today and bought every month with a regular contribution that grew with the salary.
func assertPortfolioHistory(t *testing.T, s *seeder) {
	t.Helper()

	buyMonths := map[string]bool{}
	bought := map[string]bool{}
	preTrack := 0
	first := ""

	for _, tx := range s.transactions(t) {
		if tx.Description == preTrackLabel {
			preTrack++
		}

		if !strings.HasPrefix(tx.Description, buyPrefix) {
			continue
		}

		buyMonths[tx.Date[:7]] = true
		bought[strings.TrimPrefix(tx.Description, buyPrefix)] = true

		if first == "" || tx.Date < first {
			first = tx.Date
		}
	}

	begin := s.investStart()

	if want := firstOfMonth(s.today).AddDate(-10, 0, 0); !begin.Equal(want) {
		t.Errorf("investments begin on %s, want %s", iso(begin), iso(want))
	}

	if first == "" || first > iso(begin.AddDate(0, 0, 10)) {
		t.Errorf("first purchase on %q, want within 10 days of %s", first, iso(begin))
	}

	if want := months(begin, s.today); len(buyMonths) < len(want)-3 {
		t.Errorf("months with a purchase = %d of %d, want all but 3", len(buyMonths), len(want))
	}

	if want := historyMonthsBefore(s); preTrack != want {
		t.Errorf(
			"%q = %d, want one per month before the records began (%d)",
			preTrackLabel,
			preTrack,
			want,
		)
	}

	if len(bought) < 14 {
		t.Errorf("instruments bought = %d (%v), want at least 14", len(bought), bought)
	}
}

func historyMonthsBefore(s *seeder) int {
	return len(months(s.investStart(), s.start.AddDate(0, 0, -1)))
}

// assertContributionPlan checks the plan the persona keeps: the groups of the portfolio with their ideals,
// complete at today and close to the portfolio without matching it.
func assertContributionPlan(t *testing.T, s *seeder) {
	t.Helper()

	var plan struct {
		Status string `json:"status"`
		Amount money  `json:"amount"`
		Class  []struct {
			Name     string `json:"name"`
			TargetBP int    `json:"target_bp"`
			ShareBP  int    `json:"share_bp"`
		} `json:"classes"`
		Outside []struct {
			AccountID string `json:"account_id"`
		} `json:"outside"`
		Missing []struct {
			Instrument string `json:"instrument"`
		} `json:"missing"`
	}

	s.do(http.MethodGet, "/contribution-plan", nil, &plan)

	if s.err != nil {
		t.Fatal(s.err)
	}

	if plan.Status != "complete" {
		t.Errorf("status = %q, want complete (missing %v)", plan.Status, plan.Missing)
	}

	// The financing of the car cut the monthly contribution from R$ 1.100,00 to R$ 300,00 in 2025-09.
	if plan.Amount != brl(30000) {
		t.Errorf("amount = %+v, want R$ 300,00", plan.Amount)
	}

	if len(plan.Class) != len(groups) {
		t.Fatalf("classes = %d, want %d", len(plan.Class), len(groups))
	}

	// The emergency reserve and the cash of the brokerage stay out of the plan.
	var outside []string
	for _, o := range plan.Outside {
		outside = append(outside, s.keyOf(o.AccountID))
	}

	slices.Sort(outside)

	if want := []string{"itau.savings", "nubank.reserve", "xp.cash"}; !slices.Equal(outside, want) {
		t.Errorf("investments outside every class = %v, want %v", outside, want)
	}

	off := 0

	for _, c := range plan.Class {
		t.Logf("class %q holds %d bp against an ideal of %d", c.Name, c.ShareBP, c.TargetBP)

		gap := c.ShareBP - c.TargetBP
		if gap < -1000 || gap > 1000 {
			t.Errorf(
				"class %q holds %d bp against an ideal of %d, want within 1000",
				c.Name,
				c.ShareBP,
				c.TargetBP,
			)
		}

		if gap < -50 || gap > 50 {
			off++
		}
	}

	if off == 0 {
		t.Error("every class sits on its ideal, want a portfolio that drifts a little")
	}
}
