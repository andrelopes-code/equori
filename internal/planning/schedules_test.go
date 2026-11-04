package planning_test

import (
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

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
	ActualAmount *struct {
		Amount int64 `json:"amount"`
	} `json:"actual_amount"`
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
		t.Fatalf("other book's occurrences = %d %+v", r.Status, out.Items)
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

// TestTickInBooksTimeZone: BK20. The scheduler generates up to the horizon of the book's today.
func TestTickInBooksTimeZone(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-01")
	id := f.schedule("bill", f.checking, f.rent, 210000, monthly("2026-11-01", 5, ""), nil)
	generatedUntil := func() string {
		var got string
		if err := f.h.Pool.QueryRow(t.Context(),
			`SELECT generated_until::text FROM planning_schedule WHERE id = $1`, id).Scan(&got); err != nil {
			t.Fatal(err)
		}

		return got
	}

	if got := generatedUntil(); got != "2027-11-01" {
		t.Fatalf("generated_until after create = %s, want 2027-11-01", got)
	}

	if _, err := f.h.Pool.Exec(t.Context(),
		`UPDATE identity_books SET time_zone = 'Asia/Tokyo' WHERE id = $1`, f.h.OwnerID()); err != nil {
		t.Fatal(err)
	}

	f.h.Restart(apitest.Clock(func() time.Time { return time.Date(2026, 11, 1, 20, 0, 0, 0, time.UTC) }))
	f.h.App.Planning.Tick(t.Context())

	if got := generatedUntil(); got != "2027-11-02" {
		t.Fatalf("generated_until after tick = %s, want 2027-11-02", got)
	}
}

func TestUpdateMatchingChangesOnlyTheGivenFields(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()

	var got struct {
		MatchToleranceBP int `json:"match_tolerance_bp"`
		GraceDays        int `json:"grace_days"`
		MatchWindowDays  int `json:"match_window_days"`
	}
	f.h.MustDo(http.MethodPatch, "/api/v1/schedules/"+id, map[string]any{"match_tolerance_bp": 50}, http.StatusOK, &got)

	if got.MatchToleranceBP != 50 || got.GraceDays != 3 || got.MatchWindowDays != 7 {
		t.Fatalf("patched = %+v, want tolerance 50, grace 3, window 7", got)
	}

	f.h.MustDo(http.MethodGet, "/api/v1/schedules/"+id, nil, http.StatusOK, &got)

	if got.MatchToleranceBP != 50 || got.GraceDays != 3 || got.MatchWindowDays != 7 {
		t.Fatalf("read back = %+v, want tolerance 50, grace 3, window 7", got)
	}
}

func TestUpdateMatchingNarrowsTheAmountTolerance(t *testing.T) {
	t.Parallel()

	wide := newFixture(t, "2026-11-01")
	wideID := wide.rentSchedule()
	wide.pay("2026-11-05", 214200, wide.rent, wide.landlord)

	if o := wide.occurrence(wideID, 1); o.State != "realized" {
		t.Fatalf("default tolerance: occurrence = %+v, want realized", o)
	}

	narrow := newFixture(t, "2026-11-01")
	narrowID := narrow.rentSchedule()
	narrow.h.MustDo(http.MethodPatch, "/api/v1/schedules/"+narrowID, map[string]any{"match_tolerance_bp": 50}, http.StatusOK, nil)
	narrow.pay("2026-11-05", 214200, narrow.rent, narrow.landlord)

	if o := narrow.occurrence(narrowID, 1); o.State != "expected" || o.TransactionID != "" {
		t.Fatalf("tolerance 50: occurrence = %+v, want expected", o)
	}
}

func TestUpdateMatchingRejectsAWindowAbove31(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()

	f.h.ExpectProblem(
		f.h.Do(http.MethodPatch, "/api/v1/schedules/"+id, map[string]any{"match_window_days": 32}),
		http.StatusUnprocessableEntity, "validation_failed", "match_window_days",
	)
}

func TestUpdateMatchingOfAnotherBookIs404(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	other := f.h.Login("other@example.com")

	r := f.h.Call(other, http.MethodPatch, "/api/v1/schedules/"+id, map[string]any{"match_tolerance_bp": 50})
	if r.Status != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", r.Status)
	}
}

func TestUpdateMatchingWithAnEmptyBodyChangesNothing(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()

	var got struct {
		MatchToleranceBP int `json:"match_tolerance_bp"`
		GraceDays        int `json:"grace_days"`
		MatchWindowDays  int `json:"match_window_days"`
	}
	f.h.MustDo(http.MethodPatch, "/api/v1/schedules/"+id, map[string]any{}, http.StatusOK, &got)

	if got.MatchToleranceBP != 1000 || got.GraceDays != 3 || got.MatchWindowDays != 7 {
		t.Fatalf("patched = %+v, want tolerance 1000, grace 3, window 7", got)
	}
}

// S283 (A198): the description of a schedule is renamed in place, also after it ended.
func TestRenameScheduleKeepsItsOccurrencesAndTerms(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	f.pay("2026-11-05", 210000, f.rent, f.landlord)
	f.h.MustDo(http.MethodPost, "/api/v1/schedules/"+id+"/end", map[string]string{"from": "2027-06-01"}, http.StatusOK, nil)

	var got struct {
		Description string `json:"description"`
		EndsOn      string `json:"ends_on"`
		GraceDays   int    `json:"grace_days"`
	}
	f.h.MustDo(http.MethodPatch, "/api/v1/schedules/"+id, map[string]any{"description": "Flat rent"}, http.StatusOK, &got)

	if got.Description != "Flat rent" || got.EndsOn != "2027-06-01" || got.GraceDays != 3 {
		t.Fatalf("patched = %+v, want description Flat rent, ends 2027-06-01, grace 3", got)
	}

	f.h.MustDo(http.MethodGet, "/api/v1/schedules/"+id, nil, http.StatusOK, &got)

	if got.Description != "Flat rent" {
		t.Fatalf("read back description = %q, want Flat rent", got.Description)
	}

	if o := f.occurrence(id, 1); o.State != "realized" {
		t.Fatalf("occurrence 1 = %+v, want realized", o)
	}
}

func TestRenameScheduleRejectsAnInvalidDescription(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()

	tests := map[string]string{
		"empty":          "",
		"201 characters": strings.Repeat("a", 201),
	}
	for name, description := range tests {
		t.Run(name, func(t *testing.T) {
			f.h.ExpectProblem(
				f.h.Do(http.MethodPatch, "/api/v1/schedules/"+id, map[string]any{"description": description}),
				http.StatusUnprocessableEntity, "validation_failed", "description",
			)
		})
	}
}

// S284 (A199): a schedule starts earlier than it was created to start.
func TestStartsOnMovesTheFirstDateEarlier(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-04")
	id := f.schedule("subscription", f.checking, f.rent, 600, monthly("2026-12-03", 3, ""), nil)
	before := f.occurrence(id, 1)

	var got struct {
		Terms []struct {
			EffectiveFrom string `json:"effective_from"`
			Recurrence    struct {
				Start string `json:"start"`
			} `json:"recurrence"`
		} `json:"terms"`
	}
	f.h.MustDo(http.MethodPatch, "/api/v1/schedules/"+id, map[string]any{"starts_on": "2026-11-03"}, http.StatusOK, &got)

	if len(got.Terms) != 1 || got.Terms[0].EffectiveFrom != "2026-11-03" || got.Terms[0].Recurrence.Start != "2026-11-03" {
		t.Fatalf("terms = %+v, want one version starting 2026-11-03", got.Terms)
	}

	os := f.occurrences("from=2026-10-01&to=2027-01-31&schedule_id=" + id)
	if want := []string{"2026-11-03", "2026-12-03", "2027-01-03"}; !slices.Equal(dates(os), want) {
		t.Fatalf("dates = %v, want %v", dates(os), want)
	}

	for i, o := range os {
		if o.Sequence != i+1 || o.State != "expected" {
			t.Fatalf("occurrence %d = %+v, want sequence %d, expected", i, o, i+1)
		}
	}

	if os[1].ID != before.ID {
		t.Fatalf("the occurrence of 2026-12-03 is %s, want the one that existed, %s", os[1].ID, before.ID)
	}

	f.pay("2026-11-03", 600, f.rent, "")

	if o := f.occurrence(id, 1); o.State != "realized" {
		t.Fatalf("occurrence of 2026-11-03 = %+v, want realized by the charge recorded afterwards", o)
	}
}

func TestStartsOnSkipsTheDatesPastTheGraceDays(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-04")
	id := f.schedule("subscription", f.checking, f.rent, 600, monthly("2026-12-03", 3, ""), nil)
	f.pay("2026-10-03", 600, f.rent, "")

	f.h.MustDo(http.MethodPatch, "/api/v1/schedules/"+id, map[string]any{"starts_on": "2026-09-03"}, http.StatusOK, nil)

	os := f.occurrences("from=2026-09-01&to=2027-01-31&schedule_id=" + id)
	if want := []string{"2026-09-03", "2026-10-03", "2026-11-03", "2026-12-03", "2027-01-03"}; !slices.Equal(dates(os), want) {
		t.Fatalf("dates = %v, want %v", dates(os), want)
	}

	for i, state := range []string{"skipped", "realized", "expected", "expected", "expected"} {
		if os[i].Sequence != i+1 || os[i].State != state {
			t.Fatalf("occurrence %d = %+v, want sequence %d, %s", i, os[i], i+1, state)
		}
	}
}

func TestStartsOnRejectsADateThatDoesNotMoveTheStartEarlier(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-04")
	every2 := map[string]any{"frequency": "monthly", "interval": 2, "day_of_month": 3, "start": "2026-12-03"}
	tests := map[string]struct {
		recurrence map[string]any
		startsOn   string
	}{
		"the same date":                {monthly("2026-12-03", 3, ""), "2026-12-03"},
		"a later date":                 {monthly("2026-12-03", 3, ""), "2026-12-10"},
		"a date off the rule's rhythm": {every2, "2026-11-03"},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			id := f.schedule("subscription", f.checking, f.rent, 600, tt.recurrence, nil)

			f.h.ExpectProblem(
				f.h.Do(http.MethodPatch, "/api/v1/schedules/"+id, map[string]any{"starts_on": tt.startsOn}),
				http.StatusUnprocessableEntity, "validation_failed", "starts_on",
			)
		})
	}
}

func TestStartsOnKeepsTheSequencesAcrossATermsChange(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-04")
	id := f.schedule("subscription", f.checking, f.rent, 600, monthly("2026-12-03", 3, ""), nil)
	f.h.MustDo(http.MethodPost, "/api/v1/schedules/"+id+"/terms", map[string]any{
		"effective_from": "2027-02-01", "amount": apitest.BRL(700),
	}, http.StatusCreated, nil)

	f.h.MustDo(http.MethodPatch, "/api/v1/schedules/"+id, map[string]any{"starts_on": "2026-11-03"}, http.StatusOK, nil)

	os := f.occurrences("from=2026-11-01&to=2027-03-31&schedule_id=" + id)
	if want := []string{"2026-11-03", "2026-12-03", "2027-01-03", "2027-02-03", "2027-03-03"}; !slices.Equal(dates(os), want) {
		t.Fatalf("dates = %v, want %v", dates(os), want)
	}

	for i, amount := range []int64{600, 600, 600, 700, 700} {
		if os[i].Sequence != i+1 || os[i].ExpectedAmount.Amount != amount {
			t.Fatalf("occurrence %d = %+v, want sequence %d, amount %d", i, os[i], i+1, amount)
		}
	}
}

// S285 (A200): a skipped occurrence is reopened.
func TestReopenASkippedOccurrence(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-04")
	id := f.schedule("subscription", f.checking, f.rent, 600, monthly("2026-12-03", 3, ""), nil)
	occ := f.occurrence(id, 1)
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+occ.ID+"/skip", map[string]any{"reason": "mistake"}, http.StatusOK, nil)

	var got occurrenceView
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+occ.ID+"/reopen", nil, http.StatusOK, &got)

	if got.ID != occ.ID || got.State != "expected" || got.ExpectedOn != "2026-12-03" {
		t.Fatalf("reopened = %+v, want the same occurrence, expected on 2026-12-03", got)
	}

	if o := f.occurrence(id, 1); o.State != "expected" {
		t.Fatalf("read back = %+v, want expected", o)
	}

	f.pay("2026-12-03", 600, f.rent, "")

	if o := f.occurrence(id, 1); o.State != "realized" {
		t.Fatalf("occurrence = %+v, want realized by the charge recorded after the reopen", o)
	}
}

func TestReopenRealizesWithAChargeAlreadyRecorded(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-04")
	id := f.schedule("subscription", f.checking, f.rent, 600, monthly("2026-12-03", 3, ""), nil)
	occ := f.occurrence(id, 1)
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+occ.ID+"/skip", map[string]any{}, http.StatusOK, nil)
	tx := f.pay("2026-12-03", 600, f.rent, "")

	var got occurrenceView
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+occ.ID+"/reopen", nil, http.StatusOK, &got)

	if got.State != "realized" || got.TransactionID != tx {
		t.Fatalf("reopened = %+v, want realized by %s", got, tx)
	}
}

func TestReopenRejectsAnOccurrenceThatIsNotSkipped(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-04")
	id := f.schedule("subscription", f.checking, f.rent, 600, monthly("2026-12-03", 3, ""), nil)
	occ := f.occurrence(id, 1)

	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, "/api/v1/occurrences/"+occ.ID+"/reopen", nil),
		http.StatusConflict, "occurrence_closed", "",
	)
}

func TestReopenRejectsAnOccurrenceOnOrAfterTheEnd(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-04")
	id := f.schedule("subscription", f.checking, f.rent, 600, monthly("2026-12-03", 3, ""), nil)
	occ := f.occurrence(id, 1)
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+occ.ID+"/skip", map[string]any{}, http.StatusOK, nil)
	f.h.MustDo(http.MethodPost, "/api/v1/schedules/"+id+"/end", map[string]string{"from": "2026-12-03"}, http.StatusOK, nil)

	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, "/api/v1/occurrences/"+occ.ID+"/reopen", nil),
		http.StatusConflict, "schedule_ended", "",
	)
}
