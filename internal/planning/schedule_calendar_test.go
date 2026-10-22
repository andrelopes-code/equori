package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

func TestScheduleCalendarFromRegion(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-01-01"))
	de := h.LoginAs("de@example.com", locale.Locale{Language: "en", Region: "DE"}, "EUR")
	br := h.Client

	type idOut struct {
		ID string `json:"id"`
	}
	account := func(c *http.Client, class, kind, currency string) string {
		t.Helper()
		body := map[string]any{"name": class, "class": class, "currency": currency}
		if kind != "" {
			body["kind"] = kind
		}
		r := h.Call(c, http.MethodPost, "/api/v1/accounts", body)
		if r.Status != http.StatusCreated {
			t.Fatalf("account status = %d: %s", r.Status, r.Body)
		}
		var a idOut
		r.Decode(t, &a)
		return a.ID
	}
	create := func(c *http.Client, currency string, extra map[string]any) apitest.Response {
		t.Helper()
		body := map[string]any{
			"kind": "bill", "account_id": account(c, "asset", "checking", currency),
			"counterpart_id": account(c, "expense", "", currency), "description": "rent",
			"amount":     map[string]any{"amount": 1000, "currency": currency},
			"recurrence": map[string]any{"frequency": "monthly", "interval": 1, "business_day_ordinal": 1, "start": "2026-01-01"},
		}
		for k, v := range extra {
			body[k] = v
		}
		return h.Call(c, http.MethodPost, "/api/v1/schedules", body)
	}
	created := func(c *http.Client, currency string) (id, calendar string) {
		t.Helper()
		r := create(c, currency, nil)
		if r.Status != http.StatusCreated {
			t.Fatalf("schedule status = %d: %s", r.Status, r.Body)
		}
		var s struct {
			ID       string `json:"id"`
			Calendar string `json:"calendar"`
		}
		r.Decode(t, &s)
		return s.ID, s.Calendar
	}
	firstOccurrence := func(c *http.Client, id string) string {
		t.Helper()
		r := h.Call(c, http.MethodGet, "/api/v1/occurrences?from=2026-01-01&to=2026-01-31&schedule_id="+id, nil)
		if r.Status != http.StatusOK {
			t.Fatalf("occurrences status = %d: %s", r.Status, r.Body)
		}
		var out struct {
			Items []struct {
				ExpectedOn string `json:"expected_on"`
			} `json:"items"`
		}
		r.Decode(t, &out)
		if len(out.Items) != 1 {
			t.Fatalf("occurrences = %+v", out.Items)
		}
		return out.Items[0].ExpectedOn
	}

	brID, brCalendar := created(br, "BRL")
	deID, deCalendar := created(de, "EUR")
	if brCalendar != "br_banking" || deCalendar != "weekend" {
		t.Fatalf("calendars = %q, %q, want br_banking, weekend", brCalendar, deCalendar)
	}
	if got := firstOccurrence(br, brID); got != "2026-01-02" {
		t.Fatalf("BR first occurrence = %s, want 2026-01-02", got)
	}
	if got := firstOccurrence(de, deID); got != "2026-01-01" {
		t.Fatalf("DE first occurrence = %s, want 2026-01-01", got)
	}

	// Review Focus 1: a region change keeps the calendar of existing schedules.
	if r := h.Call(de, http.MethodPatch, "/api/v1/me", map[string]string{"region": "BR"}); r.Status != http.StatusOK {
		t.Fatalf("patch me status = %d: %s", r.Status, r.Body)
	}
	r := h.Call(de, http.MethodGet, "/api/v1/schedules/"+deID, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("schedule status = %d: %s", r.Status, r.Body)
	}
	var after struct {
		Calendar string `json:"calendar"`
	}
	r.Decode(t, &after)
	if after.Calendar != "weekend" {
		t.Fatalf("calendar after region change = %q, want weekend", after.Calendar)
	}
	if got := firstOccurrence(de, deID); got != "2026-01-01" {
		t.Fatalf("DE first occurrence after region change = %s, want 2026-01-01", got)
	}

	r = create(br, "BRL", map[string]any{"calendar": "xx_yy"})
	h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "calendar")
}
