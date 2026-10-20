package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type money struct {
	Amount int64 `json:"amount"`
}

type projectionView struct {
	AccountID string `json:"account_id"`
	From      string `json:"from"`
	To        string `json:"to"`
	Opening   money  `json:"opening"`
	Closing   money  `json:"closing"`
	Points    []struct {
		Date         string `json:"date"`
		OccurrenceID string `json:"occurrence_id"`
		ScheduleID   string `json:"schedule_id"`
		Amount       money  `json:"amount"`
		Balance      money  `json:"balance"`
	} `json:"points"`
}

func (f fixture) salarySchedule() string {
	return f.schedule("income", f.checking, f.salary, 500000,
		map[string]any{"frequency": "monthly", "interval": 1, "business_day_ordinal": 5, "start": "2026-11-01"}, nil)
}

func (f fixture) projection(account, to string) projectionView {
	f.h.T().Helper()
	var out projectionView
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+account+"/projection?to="+to, nil, http.StatusOK, &out)
	return out
}

// S62: the projected balance of Nubank checking to 2026-12-31.
func TestS62Projection(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	f.h.Record("2026-10-30", apitest.Posting(f.checking, 500000), apitest.Posting(f.salary, -500000))
	rent, salary := f.rentSchedule(), f.salarySchedule()
	got := f.projection(f.checking, "2026-12-31")
	if got.AccountID != f.checking || got.From != "2026-11-01" || got.To != "2026-12-31" || got.Opening.Amount != 500000 || got.Closing.Amount != 1080000 {
		t.Fatalf("projection = %+v", got)
	}
	want := []struct {
		date            string
		schedule        string
		amount, balance int64
	}{
		{"2026-11-05", rent, -210000, 290000},
		{"2026-11-09", salary, 500000, 790000},
		{"2026-12-07", rent, -210000, 580000},
		{"2026-12-07", salary, 500000, 1080000},
	}
	if len(got.Points) != len(want) {
		t.Fatalf("points = %+v", got.Points)
	}
	for i, w := range want {
		p := got.Points[i]
		if p.Date != w.date || p.ScheduleID != w.schedule || p.Amount.Amount != w.amount || p.Balance.Amount != w.balance || p.OccurrenceID == "" {
			t.Errorf("point %d = %+v, want %+v", i, p, w)
		}
	}
}

func TestProjectionEdges(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	rent := f.rentSchedule()
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+f.occurrence(rent, 2).ID+"/skip", map[string]string{}, http.StatusOK, nil)
	f.h.Record("2026-12-20", apitest.Posting(f.checking, -10000), apitest.Posting(f.rent, 10000))
	f.h.Restart(apitest.Today("2026-11-10"))
	got := f.projection(f.checking, "2026-12-31")
	if len(got.Points) != 1 || got.Points[0].Date != "2026-11-10" || got.Points[0].Amount.Amount != -210000 {
		t.Fatalf("points = %+v, want the overdue rent dated today and no skipped occurrence", got.Points)
	}
	if got.Opening.Amount != 0 || got.Closing.Amount != -220000 {
		t.Errorf("opening %d, closing %d, want 0 and -220000", got.Opening.Amount, got.Closing.Amount)
	}
	f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/accounts/"+f.checking+"/projection?to=2027-11-11", nil), http.StatusUnprocessableEntity, "validation_failed", "to")
	f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/accounts/"+f.checking+"/projection?to=2026-11-10", nil), http.StatusUnprocessableEntity, "validation_failed", "to")
	f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/accounts/"+f.rent+"/projection?to=2026-12-31", nil), http.StatusUnprocessableEntity, "validation_failed", "id")
}

// S63: installments and expected bills and subscriptions committed in December 2026.
func TestS63CommittedAmount(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	card := f.h.Card("Itaú Visa", 3, 10, "next")
	electronics := f.h.Account("Electronics", "expense", "", nil)
	subscriptions := f.h.Account("Subscriptions", "expense", "", nil)
	f.h.MustDo(http.MethodPost, "/api/v1/installment-purchases", map[string]any{
		"card_account_id": card, "date": "2026-10-20", "description": "Laptop",
		"splits": []map[string]any{{"account_id": electronics, "amount": apitest.BRL(100000)}}, "installment_count": 3,
	}, http.StatusCreated, nil)
	f.rentSchedule()
	f.salarySchedule()
	streaming := f.schedule("subscription", card, subscriptions, 3990, monthly("2026-11-12", 12, ""), nil)
	f.schedule("transfer", f.checking, card, 150000, monthly("2026-11-01", 10, ""), nil)
	var got struct {
		Month        string `json:"month"`
		Installments money  `json:"installments"`
		Occurrences  money  `json:"occurrences"`
		Total        money  `json:"total"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/commitments?month=2026-12", nil, http.StatusOK, &got)
	if got.Month != "2026-12" || got.Installments.Amount != 33333 || got.Occurrences.Amount != 213990 || got.Total.Amount != 247323 {
		t.Fatalf("commitments = %+v", got)
	}
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+f.occurrence(streaming, 2).ID+"/skip", map[string]string{}, http.StatusOK, nil)
	f.h.MustDo(http.MethodGet, "/api/v1/commitments?month=2026-12", nil, http.StatusOK, &got)
	if got.Occurrences.Amount != 210000 || got.Total.Amount != 243333 {
		t.Fatalf("commitments after skipping the streaming = %+v", got)
	}
}
