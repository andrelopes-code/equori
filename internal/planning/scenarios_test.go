package planning_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S29: a streaming subscription with a price change, a pause and an end.
func TestS29SubscriptionWithPriceChangeAndPause(t *testing.T) {
	f := newFixture(t, "2026-11-01")
	card := f.h.Card("Itaú Visa", 3, 10, "next")
	subscriptions := f.h.Account("Subscriptions", "expense", "", nil)
	id := f.schedule("subscription", card, subscriptions, 3990, monthly("2026-11-12", 12, ""), nil)
	f.h.MustDo(http.MethodPost, "/api/v1/schedules/"+id+"/terms", map[string]any{"effective_from": "2027-01-01", "amount": apitest.BRL(4490)}, http.StatusCreated, nil)
	f.h.MustDo(http.MethodPost, "/api/v1/schedules/"+id+"/pauses", map[string]string{"from": "2027-02-01", "to": "2027-03-31"}, http.StatusCreated, nil)
	f.h.MustDo(http.MethodPost, "/api/v1/schedules/"+id+"/end", map[string]string{"from": "2027-06-01"}, http.StatusOK, nil)
	got := f.occurrences("from=2026-11-01&to=2027-10-31&schedule_id=" + id)
	want := []struct {
		date   string
		amount int64
	}{{"2026-11-12", 3990}, {"2026-12-12", 3990}, {"2027-01-12", 4490}, {"2027-04-12", 4490}, {"2027-05-12", 4490}}
	if len(got) != len(want) {
		t.Fatalf("occurrences = %v, want %v", dates(got), want)
	}
	for i, w := range want {
		if got[i].ExpectedOn != w.date || got[i].ExpectedAmount.Amount != w.amount || got[i].State != "expected" {
			t.Errorf("occurrence %d = %+v, want %s %d", i, got[i], w.date, w.amount)
		}
	}
	if seqs := []int{got[3].Sequence, got[4].Sequence}; !slices.Equal(seqs, []int{6, 7}) {
		t.Errorf("sequences after the pause = %v, want [6 7]", seqs)
	}
}

// S27: the rent PIX of 2026-11-05 realizes the 2026-11 occurrence.
func TestS27MonthlyRent(t *testing.T) {
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	tx := f.pay("2026-11-05", 210000, f.rent, f.landlord)
	f.h.Dispatch()
	got := f.occurrences("from=2026-11-01&to=2027-01-31&schedule_id=" + id)
	if len(got) != 3 {
		t.Fatalf("occurrences = %+v", got)
	}
	if got[0].State != "realized" || got[0].TransactionID != tx {
		t.Errorf("2026-11 = %+v, want realized by %s", got[0], tx)
	}
	for _, o := range got[1:] {
		if o.State != "expected" || o.TransactionID != "" {
			t.Errorf("%s = %+v, want expected", o.ExpectedOn, o)
		}
	}
}
