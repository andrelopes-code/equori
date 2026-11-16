package marketdata_test

import (
	"errors"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type hiddenInstrumentAPI struct {
	Code   string `json:"code"`
	Hidden bool   `json:"hidden"`
}

type hiddenInstrumentList struct {
	Items []hiddenInstrumentAPI `json:"items"`
}

// A238 HD1 to HD5: hiding takes the instrument out of the list of one book, `include_hidden`
// returns it, another book still lists it and showing returns it to the list.
func TestS489HideInstrument(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	other := h.LoginMember("other@example.com")

	if r := h.Do(http.MethodPut, "/api/v1/instruments/MXRF11/hidden", nil); r.Status !=
		http.StatusNoContent {
		t.Fatalf("hide status = %d: %s", r.Status, r.Body)
	}

	if r := h.Do(http.MethodPut, "/api/v1/instruments/MXRF11/hidden", nil); r.Status !=
		http.StatusNoContent {
		t.Fatalf("second hide status = %d: %s", r.Status, r.Body)
	}

	assertListed(t, h, nil, "/api/v1/instruments?type=stock", false)
	assertListed(t, h, nil, "/api/v1/instruments?include_hidden=true", true)
	assertListed(t, h, other, "/api/v1/instruments", true)

	var got hiddenInstrumentAPI
	h.MustDo(http.MethodGet, "/api/v1/instruments/MXRF11", nil, http.StatusOK, &got)

	if !got.Hidden {
		t.Fatalf("get hidden = %t, want true", got.Hidden)
	}

	if r := h.Do(http.MethodDelete, "/api/v1/instruments/MXRF11/hidden", nil); r.Status !=
		http.StatusNoContent {
		t.Fatalf("show status = %d: %s", r.Status, r.Body)
	}

	assertListed(t, h, nil, "/api/v1/instruments", true)

	h.ExpectProblem(
		h.Do(http.MethodPut, "/api/v1/instruments/PETR4/hidden", nil),
		http.StatusNotFound,
		"not_found",
		"",
	)
	h.ExpectProblem(
		h.Do(http.MethodPut, "/api/v1/instruments/BRL/hidden", nil),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"code",
	)
}

// A238 R1: a security that an account holds is refused on removal and can be hidden.
func TestS490HideInstrumentInUse(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	var inst struct {
		ID string `json:"id"`
	}
	h.MustDo(
		http.MethodPost,
		"/api/v1/institutions",
		map[string]string{"name": "XP"},
		http.StatusCreated,
		&inst,
	)

	parent := h.Account(
		"XP",
		"asset",
		"brokerage",
		map[string]any{"institution_id": inst.ID, "currency": "BRL"},
	)
	h.Account(
		"XP MXRF11",
		"asset",
		"brokerage",
		map[string]any{"institution_id": inst.ID, "parent_id": parent, "currency": "MXRF11"},
	)

	h.ExpectProblem(
		h.Do(http.MethodDelete, "/api/v1/instruments/MXRF11", nil),
		http.StatusConflict,
		"instrument_in_use",
		"",
	)

	if r := h.Do(http.MethodPut, "/api/v1/instruments/MXRF11/hidden", nil); r.Status !=
		http.StatusNoContent {
		t.Fatalf("hide status = %d: %s", r.Status, r.Body)
	}

	assertListed(t, h, nil, "/api/v1/instruments", false)
}

// A238 HD6: removing a hidden security that nothing references deletes it with its hidden row.
func TestDeleteHiddenInstrument(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)
	h.MustDo(http.MethodPut, "/api/v1/instruments/MXRF11/hidden", nil, http.StatusNoContent, nil)

	if r := h.Do(http.MethodDelete, "/api/v1/instruments/MXRF11", nil); r.Status !=
		http.StatusNoContent {
		t.Fatalf("delete status = %d: %s", r.Status, r.Body)
	}

	var rows int
	if err := h.Pool.QueryRow(
		t.Context(), `SELECT count(*) FROM marketdata_instrument_hidden`,
	).Scan(&rows); err != nil {
		t.Fatal(err)
	}

	if rows != 0 {
		t.Fatalf("hidden rows = %d, want 0", rows)
	}
}

// A238 B1, B2: hiding is a write of the book; a reader and a visitor are refused.
func TestHideInstrumentRoles(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")

	for _, method := range []string{http.MethodPut, http.MethodDelete} {
		h.ExpectProblem(
			h.Call(reader, method, "/api/v1/instruments/MXRF11/hidden", nil),
			http.StatusForbidden,
			"book_role_required",
			"",
		)
		h.ExpectProblem(
			h.Call(&http.Client{}, method, "/api/v1/instruments/MXRF11/hidden", nil),
			http.StatusUnauthorized,
			"unauthenticated",
			"",
		)
	}
}

// A238 B1: a hidden row without a book is rejected by the schema.
func TestHiddenInstrumentRequiresBook(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	_, err := h.Pool.Exec(
		t.Context(),
		`INSERT INTO marketdata_instrument_hidden (books_id, instrument) VALUES (NULL, 'MXRF11')`,
	)

	if pgErr, ok := errors.AsType[*pgconn.PgError](err); !ok || pgErr.Code != "23502" {
		t.Fatalf("insert without books_id error = %v, want a not-null violation (23502)", err)
	}
}

// assertListed fetches path as client (the owner when nil) and checks whether MXRF11 is listed;
// a listed row carries hidden = true only when the path asks for hidden rows.
func assertListed(t *testing.T, h *apitest.Harness, client *http.Client, path string, want bool) {
	t.Helper()

	if client == nil {
		client = h.Client
	}

	var list hiddenInstrumentList

	r := h.Call(client, http.MethodGet, path, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("GET %s status = %d: %s", path, r.Status, r.Body)
	}

	r.Decode(t, &list)

	listed := false

	for _, in := range list.Items {
		if in.Code == "MXRF11" {
			listed = true
		}
	}

	if listed != want {
		t.Fatalf("GET %s lists MXRF11 = %t, want %t", path, listed, want)
	}
}
