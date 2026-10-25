package main

import (
	"net/http"
	"net/url"
	"time"
)

type statementRow struct {
	ID      string `json:"id"`
	DueDate string `json:"due_date"`
	Status  string `json:"status"`
	Unpaid  money  `json:"unpaid"`
}

// payStatements pays, from payer, every closed statement of the card whose due date is within five days; a nominal due day on a weekend or holiday moves to the next business day.
func (s *seeder) payStatements(date time.Time, card, payer string) {
	var out struct {
		Items []statementRow `json:"items"`
	}
	q := url.Values{"from": {ym(date.AddDate(0, -2, 0))}, "to": {ym(date.AddDate(0, 1, 0))}}
	s.do(http.MethodGet, "/accounts/"+s.id(card)+"/statements?"+q.Encode(), nil, &out)
	for _, st := range out.Items {
		if s.err != nil {
			return
		}
		due, err := time.Parse(time.DateOnly, st.DueDate)
		if err != nil || st.Status == "open" || st.Unpaid.Amount <= 0 || due.After(date.AddDate(0, 0, 5)) {
			continue
		}
		s.ensure(date, payer, st.Unpaid.Amount)
		s.do(http.MethodPost, "/statements/"+st.ID+"/payments", map[string]any{"date": iso(date), "from_account_id": s.id(payer), "amount": st.Unpaid}, nil)
		s.bal[s.id(payer)] -= st.Unpaid.Amount
		s.bal[s.id(card)] += st.Unpaid.Amount
	}
}

// statementPayments schedules the payment of each card the day before the due date.
func (s *seeder) statementPayments(month time.Time) {
	itauDay := 9
	nubankDay := step(month, 11, map[string]int64{"2026-04": 16})
	s.at(onDay(month, itauDay), func() { s.payStatements(onDay(month, itauDay), "card.itau", "itau.checking") })
	s.at(onDay(month, int(nubankDay)), func() { s.payStatements(onDay(month, int(nubankDay)), "card.nubank", "nubank.checking") })
}
