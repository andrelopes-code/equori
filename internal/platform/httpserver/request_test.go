package httpserver_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

type listParams struct {
	Date  openapi_types.Date `form:"date" json:"date"`
	Limit *int               `form:"limit,omitempty" json:"limit,omitempty"`
	Kind  *string            `form:"kind,omitempty" json:"kind,omitempty"`
}

func TestQuery(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		check   func(t *testing.T, p listParams)
		wantErr bool
	}{
		{
			name: "binds required and optional values",
			url:  "/x?date=2026-11-20&limit=25&kind=income",
			check: func(t *testing.T, p listParams) {
				t.Helper()

				if got := p.Date.Format("2006-01-02"); got != "2026-11-20" {
					t.Errorf("date = %s", got)
				}

				if p.Limit == nil || *p.Limit != 25 {
					t.Errorf("limit = %v", p.Limit)
				}

				if p.Kind == nil || *p.Kind != "income" {
					t.Errorf("kind = %v", p.Kind)
				}
			},
		},
		{
			name: "leaves an absent optional value nil",
			url:  "/x?date=2026-11-20",
			check: func(t *testing.T, p listParams) {
				t.Helper()

				if p.Limit != nil || p.Kind != nil {
					t.Errorf("optional values bound: %v %v", p.Limit, p.Kind)
				}
			},
		},
		{name: "rejects a missing required value", url: "/x?limit=5", wantErr: true},
		{name: "rejects a value of the wrong type", url: "/x?date=2026-11-20&limit=many", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, tt.url, http.NoBody)

			p, err := httpserver.Query[listParams](req)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, want error %v", err, tt.wantErr)
			}

			if tt.check != nil {
				tt.check(t, p)
			}
		})
	}
}

func TestPathValues(t *testing.T) {
	id := uuid.MustParse("6f1c2b1e-9a39-4c53-8a0e-5a7a0a0f6a11")

	mux := http.NewServeMux()
	mux.HandleFunc("GET /things/{id}/years/{year}", func(w http.ResponseWriter, r *http.Request) {
		gotID, errID := httpserver.PathUUID(r, "id")
		year, errYear := httpserver.PathInt64(r, "year")

		if errID != nil || gotID != id || errYear != nil || year != 2026 {
			t.Errorf("id = %v (%v), year = %d (%v)", gotID, errID, year, errYear)
		}

		w.WriteHeader(http.StatusNoContent)
	})

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/things/"+id.String()+"/years/2026", http.NoBody)
	mux.ServeHTTP(httptest.NewRecorder(), req)

	bad := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/x", http.NoBody)
	bad.SetPathValue("id", "nope")

	if _, err := httpserver.PathUUID(bad, "id"); err == nil {
		t.Error("PathUUID accepted a malformed value")
	}
}
