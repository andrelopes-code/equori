package main

import (
	"maps"
	"net/http"
	"slices"
	"time"
)

type scheduleSpec struct {
	key, kind, account, counterpart, payee, desc string
	cents                                        int64
	day, businessDay                             int
	start                                        string
	terms                                        map[string]int64 // effective date to amount
	until                                        string
	toleranceBP                                  int
}

// netSalary is the payroll deposit of a month, used as the expected amount of the salary schedule.
func netSalary(month time.Time) int64 {
	g := gross(month)
	inss := inssOf(month)

	return g - inss - irrfOf(g-inss, month) - healthPlanDiscount
}

// priceInForce is the amount of the latest term of the schedule that has begun. A schedule is created today, so its occurrences of the past keep the amount it was created with: the one in force, which the recent months match exactly.
func (s *seeder) priceInForce(sp scheduleSpec) int64 {
	cents := sp.cents

	for _, from := range slices.Sorted(maps.Keys(sp.terms)) {
		if from <= iso(s.today) {
			cents = sp.terms[from]
		}
	}

	return cents
}

func (s *seeder) buildSchedules() {
	for _, sp := range schedules(s.start) {
		rec := map[string]any{"frequency": "monthly", "interval": 1, "start": sp.start}
		if sp.businessDay > 0 {
			rec["business_day_ordinal"] = sp.businessDay
		} else {
			rec["day_of_month"] = sp.day
		}

		body := map[string]any{
			"kind":           sp.kind,
			"account_id":     s.id(sp.account),
			"counterpart_id": s.id(sp.counterpart),
			"description":    sp.desc,
			"amount":         brl(s.priceInForce(sp)),
			"recurrence":     rec,
		}
		if sp.payee != "" {
			body["payee_id"] = s.id("payee." + sp.payee)
		}

		if sp.toleranceBP > 0 {
			body["match_tolerance_bp"] = sp.toleranceBP
		}

		id := s.create("/schedules", body)

		s.ids["schedule."+sp.key] = id
		for _, from := range slices.Sorted(maps.Keys(sp.terms)) {
			if from > iso(s.today) {
				s.do(
					http.MethodPost,
					"/schedules/"+id+"/terms",
					map[string]any{"effective_from": from, "amount": brl(sp.terms[from])},
					nil,
				)
			}
		}

		if sp.until != "" {
			s.do(http.MethodPost, "/schedules/"+id+"/end", map[string]any{"from": sp.until}, nil)
		}
	}

	// The gym is paused while the owner travels in Portugal.
	s.do(
		http.MethodPost,
		"/schedules/"+s.id("schedule.gym")+"/pauses",
		map[string]any{"from": "2025-07-01", "to": "2025-07-31"},
		nil,
	)
}

// saveSavingsTarget sets the share of the average income that the owner sets aside, 20 %, on the plan of the current month.
func (s *seeder) saveSavingsTarget() {
	s.do(http.MethodPut, "/budget-plan?month="+ym(s.today), map[string]any{
		"source": "average_income", "savings_target_bp": 2000, "amounts": []any{},
	}, nil)
}

// reopenHistory makes every skipped occurrence of the past expected again. A recorded transaction that fits an occurrence realizes it on reopening, so the schedules read as kept since the first month.
func (s *seeder) reopenHistory() {
	end := s.today.AddDate(0, 0, -1)
	for from := s.start; !from.After(end); from = from.AddDate(0, 0, 360) {
		to := from.AddDate(0, 0, 359)
		if to.After(end) {
			to = end
		}

		var out struct {
			Items []struct {
				ID string `json:"id"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/occurrences?state=skipped&from="+iso(from)+"&to="+iso(to), nil, &out)

		for _, o := range out.Items {
			s.do(http.MethodPost, "/occurrences/"+o.ID+"/reopen", nil, nil)
			s.tolerate("validation_failed") // the date falls inside a pause of the schedule.
			s.tolerate("schedule_ended")    // the schedule ended before the date.
		}
	}
}

// The amounts follow what the persona spends in a month, a tenth above: a rollover budget far above the spending would carry years of savings. The budgets cover every category the persona spends in, the fixed ones as groups, so that no month leaves a large part of the spending unbudgeted.
func (s *seeder) buildBudgets() {
	for _, b := range budgetSpecs {
		id := s.create(
			"/budgets",
			map[string]any{
				"category_id":    s.id(b.category),
				"amount":         brl(b.cents),
				"effective_from": ym(s.start),
				"rollover":       b.rollover,
			},
		)
		for _, from := range slices.Sorted(maps.Keys(b.steps)) {
			s.do(
				http.MethodPost,
				"/budgets/"+id+"/amounts",
				map[string]any{"effective_from": from, "amount": brl(b.steps[from])},
				nil,
			)
		}
	}
}
