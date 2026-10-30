package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type syncSchedule struct {
	Minutes int `json:"minutes"`
}

// S190: the sync interval belongs to the instance and only an admin changes it (ADR 029 BK23).
func TestS190SyncSchedule(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	member := h.LoginMember("member@example.com")
	const path = "/api/v1/ingestion/sync-schedule"

	wantMinutes := func(r apitest.Response, want int) {
		t.Helper()

		if r.Status != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", r.Status, r.Body)
		}

		var got syncSchedule
		r.Decode(t, &got)

		if got.Minutes != want {
			t.Fatalf("minutes = %d, want %d", got.Minutes, want)
		}
	}

	wantMinutes(h.Do(http.MethodGet, path, nil), 60)
	h.ExpectProblem(h.Call(member, http.MethodPut, path, syncSchedule{Minutes: 15}), http.StatusForbidden, "admin_required", "")
	wantMinutes(h.Do(http.MethodPut, path, syncSchedule{Minutes: 15}), 15)
	wantMinutes(h.Call(member, http.MethodGet, path, nil), 15)
	h.ExpectProblem(h.Do(http.MethodPut, path, syncSchedule{Minutes: 0}), http.StatusBadRequest, "invalid_request", "minutes")
	h.ExpectProblem(h.Do(http.MethodPut, path, syncSchedule{Minutes: 1441}), http.StatusBadRequest, "invalid_request", "minutes")
	wantMinutes(h.Do(http.MethodGet, path, nil), 15)
}
