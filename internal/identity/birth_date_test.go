package identity_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// PJ6: the birth date is absent until set, kept by a patch without it and cleared by null.
func TestBirthDate(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-24"))

	assertBirthDate(t, h, "")

	h.MustDo(
		http.MethodPatch,
		"/api/v1/me",
		map[string]any{"birth_date": "1985-03-17"},
		http.StatusOK,
		nil,
	)
	assertBirthDate(t, h, "1985-03-17")

	h.MustDo(http.MethodPatch, "/api/v1/me", map[string]any{"language": "en"}, http.StatusOK, nil)
	assertBirthDate(t, h, "1985-03-17")

	h.MustDo(http.MethodPatch, "/api/v1/me", map[string]any{"birth_date": nil}, http.StatusOK, nil)
	assertBirthDate(t, h, "")
}

// The bounds are 1900-01-01 and the date of the request, both inclusive.
func TestBirthDateBounds(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value string
		ok    bool
	}{
		{"before 1900", "1899-12-31", false},
		{"first day of 1900", "1900-01-01", true},
		{"today", "2026-11-24", true},
		{"tomorrow", "2026-11-25", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			h := apitest.New(t, apitest.Today("2026-11-24"))
			r := h.Do(http.MethodPatch, "/api/v1/me", map[string]any{"birth_date": tt.value})

			if tt.ok {
				if r.Status != http.StatusOK {
					t.Fatalf("status = %d: %s", r.Status, r.Body)
				}

				assertBirthDate(t, h, tt.value)

				return
			}

			h.ExpectProblem(r, http.StatusBadRequest, "invalid_request", "birth_date")
			assertBirthDate(t, h, "")
		})
	}
}

// A malformed date is a malformed request.
func TestBirthDateMalformed(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-24"))

	h.ExpectProblem(
		h.Do(http.MethodPatch, "/api/v1/me", map[string]any{"birth_date": "17/03/1985"}),
		http.StatusBadRequest, "invalid_request", "",
	)
}

// The birth date belongs to the member that sets it.
func TestBirthDateOfAnotherMember(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-24"))
	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")

	r := h.Call(reader, http.MethodPatch, "/api/v1/me", map[string]any{"birth_date": "1990-01-02"})
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	assertBirthDate(t, h, "")

	r = h.Call(reader, http.MethodGet, "/api/v1/me", nil)

	var me map[string]any

	r.Decode(t, &me)

	if me["birth_date"] != "1990-01-02" {
		t.Fatalf("reader birth_date = %v, want 1990-01-02", me["birth_date"])
	}
}

// assertBirthDate reads the owner profile; an empty want means the field is absent.
func assertBirthDate(t *testing.T, h *apitest.Harness, want string) {
	t.Helper()

	var me map[string]any

	h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &me)

	got, present := me["birth_date"]
	if want == "" {
		if present {
			t.Fatalf("birth_date = %v, want absent", got)
		}

		return
	}

	if got != want {
		t.Fatalf("birth_date = %v, want %s", got, want)
	}
}
