package planning_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type occurrenceView struct {
	ID             string `json:"id"`
	ScheduleID     string `json:"schedule_id"`
	Sequence       int    `json:"sequence"`
	ExpectedOn     string `json:"expected_on"`
	ExpectedAmount struct {
		Amount int64 `json:"amount"`
	} `json:"expected_amount"`
	State         string `json:"state"`
	TransactionID string `json:"transaction_id"`
	MovedFrom     string `json:"moved_from"`
}

type fixture struct {
	h                               *apitest.Harness
	checking, rent, salary, savings string
	landlord                        string
}

func newFixture(t *testing.T, today string) fixture {
	t.Helper()
	h := apitest.New(t, apitest.Today(today))
	f := fixture{h: h}
	f.checking = h.Account("Nubank checking", "asset", "checking", nil)
	f.savings = h.Account("Emergency fund", "asset", "savings", nil)
	f.rent = h.Account("Rent", "expense", "", nil)
	f.salary = h.Account("Salary", "income", "", nil)
	var payee struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": "Landlord"}, http.StatusCreated, &payee)
	f.landlord = payee.ID
	return f
}

func monthly(start string, day int, adjustment string) map[string]any {
	r := map[string]any{"frequency": "monthly", "interval": 1, "day_of_month": day, "start": start}
	if adjustment != "" {
		r["adjustment"] = adjustment
	}
	return r
}

// schedule creates a schedule and returns its id.
func (f fixture) schedule(kind, account, counterpart string, amount int64, recurrence map[string]any, extra map[string]any) string {
	f.h.T().Helper()
	body := map[string]any{
		"kind": kind, "account_id": account, "counterpart_id": counterpart, "description": kind,
		"amount": apitest.BRL(amount), "recurrence": recurrence,
	}
	for k, v := range extra {
		body[k] = v
	}
	var out struct {
		ID string `json:"id"`
	}
	f.h.MustDo(http.MethodPost, "/api/v1/schedules", body, http.StatusCreated, &out)
	return out.ID
}

func (f fixture) occurrences(query string) []occurrenceView {
	f.h.T().Helper()
	var out struct {
		Items []occurrenceView `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/occurrences?"+query, nil, http.StatusOK, &out)
	return out.Items
}

func dates(os []occurrenceView) []string {
	out := make([]string, len(os))
	for i, o := range os {
		out[i] = o.ExpectedOn
	}
	return out
}

// S27: monthly rent on day 5 with business-day adjustment following.
func TestS27RentDates(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.schedule("bill", f.checking, f.rent, 210000, monthly("2026-11-01", 5, "following"), map[string]any{"payee_id": f.landlord})
	got := f.occurrences("from=2026-11-01&to=2027-01-31&schedule_id=" + id)
	if want := []string{"2026-11-05", "2026-12-07", "2027-01-05"}; !slices.Equal(dates(got), want) {
		t.Fatalf("dates = %v, want %v", dates(got), want)
	}
	for i, o := range got {
		if o.Sequence != i+1 || o.State != "expected" || o.ExpectedAmount.Amount != 210000 || o.ScheduleID != id {
			t.Errorf("occurrence %d = %+v", i, o)
		}
	}
}

// S28: day 31 resolves to the last day of shorter months.
func TestS28Day31Dates(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.schedule("bill", f.checking, f.rent, 10000, monthly("2027-01-31", 31, ""), nil)
	got := f.occurrences("from=2027-01-01&to=2027-04-30&schedule_id=" + id)
	if want := []string{"2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"}; !slices.Equal(dates(got), want) {
		t.Fatalf("dates = %v, want %v", dates(got), want)
	}
}

func TestScheduleIsReadBack(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.schedule("bill", f.checking, f.rent, 210000, monthly("2026-11-01", 5, "following"), map[string]any{"payee_id": f.landlord})
	var s struct {
		ID               string `json:"id"`
		Kind             string `json:"kind"`
		PayeeID          string `json:"payee_id"`
		MatchToleranceBP int    `json:"match_tolerance_bp"`
		GraceDays        int    `json:"grace_days"`
		Terms            []struct {
			EffectiveFrom string `json:"effective_from"`
			Amount        struct {
				Amount int64 `json:"amount"`
			} `json:"amount"`
			Recurrence struct {
				Frequency  string `json:"frequency"`
				DayOfMonth int    `json:"day_of_month"`
				Adjustment string `json:"adjustment"`
				Start      string `json:"start"`
			} `json:"recurrence"`
		} `json:"terms"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/schedules/"+id, nil, http.StatusOK, &s)
	if s.Kind != "bill" || s.PayeeID != f.landlord || s.MatchToleranceBP != 1000 || s.GraceDays != 3 || len(s.Terms) != 1 {
		t.Fatalf("schedule = %+v", s)
	}
	term := s.Terms[0]
	if term.EffectiveFrom != "2026-11-01" || term.Amount.Amount != 210000 || term.Recurrence.Frequency != "monthly" ||
		term.Recurrence.DayOfMonth != 5 || term.Recurrence.Adjustment != "following" || term.Recurrence.Start != "2026-11-01" {
		t.Errorf("terms = %+v", term)
	}
	var list struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/schedules", nil, http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].ID != id {
		t.Errorf("list = %+v", list)
	}
}

// A49, A53: occurrences reach today + 12 months; a tick extends the horizon once.
func TestHorizonAndTick(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.schedule("bill", f.checking, f.rent, 210000, monthly("2026-11-01", 5, ""), nil)
	if got := f.occurrences("from=2026-11-01&to=2027-10-31&schedule_id=" + id); len(got) != 12 {
		t.Fatalf("occurrences in the first horizon = %d, want 12", len(got))
	}
	if got := f.occurrences("from=2027-11-01&to=2028-10-31&schedule_id=" + id); len(got) != 0 {
		t.Fatalf("occurrences past the horizon = %v", dates(got))
	}
	f.h.Restart(apitest.Today("2026-12-01"))
	f.h.App.Planning.Tick(t.Context())
	f.h.App.Planning.Tick(t.Context())
	got := f.occurrences("from=2027-11-01&to=2028-10-31&schedule_id=" + id)
	if !slices.Equal(dates(got), []string{"2027-11-05"}) || got[0].Sequence != 13 {
		t.Fatalf("occurrences after the tick = %+v", got)
	}
}

func TestScheduleValidation(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	body := func(kind, counterpart string) map[string]any {
		return map[string]any{
			"kind": kind, "account_id": f.checking, "counterpart_id": counterpart, "description": "x",
			"amount": apitest.BRL(100), "recurrence": monthly("2026-11-01", 5, ""),
		}
	}
	tests := []struct {
		name        string
		kind        string
		counterpart string
	}{
		{"bill to an income category", "bill", f.salary},
		{"income to an expense category", "income", f.rent},
		{"transfer to a category", "transfer", f.rent},
		{"savings to the same account", "savings", f.checking},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/schedules", body(tt.kind, tt.counterpart)), http.StatusUnprocessableEntity, "validation_failed", "counterpart_id")
		})
	}
	bad := body("bill", f.rent)
	bad["recurrence"] = map[string]any{"frequency": "monthly", "interval": 1, "start": "2026-11-01"}
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/schedules", bad), http.StatusUnprocessableEntity, "validation_failed", "recurrence")
	transfer := body("savings", f.savings)
	f.h.MustDo(http.MethodPost, "/api/v1/schedules", transfer, http.StatusCreated, nil)
}

// P8 amendment A72: the amount is in the currency of account_id.
func TestScheduleAmountInAccountCurrency(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	wise := f.h.Account("Wise", "asset", "checking", map[string]any{"currency": "USD"})
	r := f.h.Do(http.MethodPost, "/api/v1/schedules", map[string]any{
		"kind": "bill", "account_id": wise, "counterpart_id": f.rent, "description": "x",
		"amount": apitest.BRL(100), "recurrence": monthly("2026-11-01", 5, ""),
	})
	f.h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "amount.currency")
}

func TestScheduleOfAnotherUser(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.schedule("bill", f.checking, f.rent, 100, monthly("2026-11-01", 5, ""), nil)
	other := f.h.Login("other@example.com")
	if r := f.h.Call(other, http.MethodGet, "/api/v1/schedules/"+id, nil); r.Status != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", r.Status)
	}
	var out struct {
		Items []occurrenceView `json:"items"`
	}
	r := f.h.Call(other, http.MethodGet, "/api/v1/occurrences?from=2026-11-01&to=2027-10-31", nil)
	r.Decode(t, &out)
	if r.Status != http.StatusOK || len(out.Items) != 0 {
		t.Fatalf("other user's occurrences = %d %+v", r.Status, out.Items)
	}
	r = f.h.Call(other, http.MethodPost, "/api/v1/schedules", map[string]any{
		"kind": "bill", "account_id": f.checking, "counterpart_id": f.rent, "description": "x",
		"amount": apitest.BRL(100), "recurrence": monthly("2026-11-01", 5, ""),
	})
	f.h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "account_id")
}

func TestOccurrenceRangeLimit(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/occurrences?from=2026-11-01&to=2027-12-06", nil), http.StatusUnprocessableEntity, "validation_failed", "to")
	f.h.ExpectProblem(f.h.Do(http.MethodGet, "/api/v1/occurrences?from=2026-11-02&to=2026-11-01", nil), http.StatusUnprocessableEntity, "validation_failed", "to")
}
