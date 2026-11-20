package main

import "net/http"

// corporateActions schedules every split and bonus of the history on its date.
func (s *seeder) corporateActions() {
	for _, a := range actions {
		s.investAt(day(a.date), func() { s.applyCorporateAction(a) })
	}
}

// applyCorporateAction records a on the holding of its security and adjusts the units the persona holds. A security
// priced by the synthetic walk keeps its units: the walk holds no event.
func (s *seeder) applyCorporateAction(a corporateAction) {
	held := s.hold[a.code]
	if held == 0 || len(s.quotes[a.code]) == 0 {
		return
	}

	s.do(http.MethodPost, "/corporate-actions", map[string]any{
		"account_id": s.id(s.security(a.code).key()),
		"kind":       a.kind,
		"date":       a.date,
		"ratio_from": a.from,
		"ratio_to":   a.to,
	}, nil)

	s.hold[a.code] = held * a.to / a.from
}
