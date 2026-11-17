package main

import "net/http"

// saveContributionPlan states the groups of the portfolio and their ideals as the plan of the book, with the monthly contribution as its amount.
func (s *seeder) saveContributionPlan() {
	classes := make([]map[string]any, len(groups))

	for i, g := range groups {
		classes[i] = map[string]any{
			"name":      g.name,
			"target_bp": g.bp,
			"members":   g.planMembers(),
		}
	}

	fixed, _ := classes[fixedIncomeGroup]["members"].([]map[string]any)
	for _, c := range s.applied {
		fixed = append(fixed, map[string]any{"instrument": c.code})
	}

	classes[fixedIncomeGroup]["members"] = fixed

	s.do(http.MethodPut, "/contribution-plan", map[string]any{
		"amount":  brl(monthlyContribution(investMonths)),
		"classes": classes,
	}, nil)
}

// planMembers lists the instruments of a group; a split group gives each one its share of the group in basis points.
func (g group) planMembers() []map[string]any {
	out := make([]map[string]any, len(g.members))

	var weights int
	for _, m := range g.members {
		weights += m.weight
	}

	left := 10000

	for i, m := range g.members {
		out[i] = map[string]any{"instrument": m.code}

		if !g.split {
			continue
		}

		bp := m.weight * 10000 / weights
		if i == len(g.members)-1 {
			bp = left
		}

		out[i]["target_bp"] = bp
		left -= bp
	}

	return out
}
