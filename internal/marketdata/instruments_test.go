package marketdata_test

import (
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

type instrumentAPI struct {
	Code          string `json:"code"`
	Type          string `json:"type"`
	Scale         int    `json:"scale"`
	Name          string `json:"name"`
	QuoteCurrency string `json:"quote_currency"`
	Exchange      string `json:"exchange"`
	Subtype       string `json:"subtype"`
}

func mxrf11() map[string]any {
	return map[string]any{
		"code":           "MXRF11",
		"type":           "reit",
		"scale":          0,
		"name":           "Maxi Renda",
		"quote_currency": "BRL",
		"exchange":       "BVMF",
	}
}

func TestDefineInstrument(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	r := h.Do(http.MethodPost, "/api/v1/instruments", mxrf11())
	var got instrumentAPI

	if r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &got)

	if r.Header.Get("Location") != "/api/v1/instruments/MXRF11" {
		t.Fatalf("Location = %q", r.Header.Get("Location"))
	}

	if got != (instrumentAPI{Code: "MXRF11", Type: "reit", Scale: 0, Name: "Maxi Renda", QuoteCurrency: "BRL", Exchange: "BVMF"}) {
		t.Fatalf("instrument = %+v", got)
	}

	var read instrumentAPI
	h.MustDo(http.MethodGet, "/api/v1/instruments/MXRF11", nil, http.StatusOK, &read)

	if read != got {
		t.Fatalf("read = %+v", read)
	}

	var list struct {
		Items []instrumentAPI `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/instruments?type=reit", nil, http.StatusOK, &list)

	if len(list.Items) != 1 || list.Items[0].Code != "MXRF11" {
		t.Fatalf("reit list = %+v", list)
	}

	h.MustDo(http.MethodGet, "/api/v1/instruments?type=currency", nil, http.StatusOK, &list)

	brl := slices.IndexFunc(list.Items, func(i instrumentAPI) bool { return i.Code == "BRL" })
	if len(list.Items) != len(money.Currencies()) || brl < 0 ||
		list.Items[brl].QuoteCurrency != "" {
		t.Fatalf("currency list = %+v", list.Items)
	}

	h.ExpectProblem(
		h.Do(http.MethodPost, "/api/v1/instruments", mxrf11()),
		http.StatusConflict,
		"instrument_exists",
		"",
	)
	h.ExpectProblem(
		h.Do(http.MethodGet, "/api/v1/instruments/PETR4", nil),
		http.StatusNotFound,
		"not_found",
		"",
	)
}

func TestDefineInstrumentValidation(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	with := func(k string, v any) map[string]any {
		in := mxrf11()
		in[k] = v

		return in
	}

	tests := []struct {
		name  string
		body  map[string]any
		field string
	}{
		{name: "currency type", body: with("type", "currency"), field: "type"},
		{
			name:  "quote is a security",
			body:  with("quote_currency", "PETR4"),
			field: "quote_currency",
		},
		{name: "unknown quote", body: with("quote_currency", "XYZ"), field: "quote_currency"},
		{name: "blank name", body: with("name", "  "), field: "name"},
		{name: "code of a currency", body: with("code", "BRL"), field: "code"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h.ExpectProblem(
				h.Do(http.MethodPost, "/api/v1/instruments", tt.body),
				http.StatusUnprocessableEntity,
				"validation_failed",
				tt.field,
			)
		})
	}

	for _, body := range []map[string]any{with("exchange", "B3"), with("exchange", "bvmf"), with("type", "fii"), with("type", "bdr")} {
		h.ExpectProblem(
			h.Do(http.MethodPost, "/api/v1/instruments", body),
			http.StatusBadRequest,
			"invalid_request",
			"",
		)
	}

	for _, body := range []map[string]any{with("exchange", "XNYS"), with("type", "depositary_receipt")} {
		if r := h.Do(
			http.MethodPost,
			"/api/v1/instruments",
			body,
		); r.Status != http.StatusCreated &&
			r.Status != http.StatusConflict {
			t.Fatalf("status %d: %s", r.Status, r.Body)
		}
	}

	h.ExpectProblem(
		h.Do(http.MethodPost, "/api/v1/instruments", with("scale", 13)),
		http.StatusBadRequest,
		"invalid_request",
		"",
	)
	h.ExpectProblem(
		h.Do(http.MethodPost, "/api/v1/instruments", with("code", "mxrf11")),
		http.StatusBadRequest,
		"invalid_request",
		"",
	)
}

// S171: editing replaces name, exchange and subtype and keeps the rest of the instrument (amendment A134).
func TestS171EditInstrument(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)
	h.MustDo(
		http.MethodPost,
		"/api/v1/prices",
		map[string]any{
			"instrument":       "MXRF11",
			"quote_instrument": "BRL",
			"date":             "2026-10-22",
			"value":            "10.50",
		},
		http.StatusCreated,
		nil,
	)

	var got instrumentAPI
	h.MustDo(
		http.MethodPatch,
		"/api/v1/instruments/MXRF11",
		map[string]any{"name": "Maxi Renda FII", "subtype": "fii_papel"},
		http.StatusOK,
		&got,
	)

	want := instrumentAPI{
		Code:          "MXRF11",
		Type:          "reit",
		Scale:         0,
		Name:          "Maxi Renda FII",
		QuoteCurrency: "BRL",
		Subtype:       "fii_papel",
	}
	if got != want {
		t.Fatalf("edited = %+v, want %+v", got, want)
	}

	var read instrumentAPI
	h.MustDo(http.MethodGet, "/api/v1/instruments/MXRF11", nil, http.StatusOK, &read)

	if read != want {
		t.Fatalf("read = %+v, want %+v", read, want)
	}

	var prices struct {
		Items []priceAPI `json:"items"`
	}
	h.MustDo(
		http.MethodGet,
		"/api/v1/prices?instrument=MXRF11&quote_instrument=BRL&from=2026-10-01&to=2026-10-31",
		nil,
		http.StatusOK,
		&prices,
	)

	if len(prices.Items) != 1 ||
		prices.Items[0] != (priceAPI{Instrument: "MXRF11", QuoteInstrument: "BRL", Date: "2026-10-22", Value: "10.5", Source: "manual"}) {
		t.Fatalf("prices = %+v", prices.Items)
	}

	h.ExpectProblem(
		h.Do(http.MethodPatch, "/api/v1/instruments/MXRF11", map[string]any{"name": "  "}),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"name",
	)
	h.ExpectProblem(
		h.Do(http.MethodPatch, "/api/v1/instruments/BRL", map[string]any{"name": "Real"}),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"code",
	)
	h.ExpectProblem(
		h.Do(http.MethodPatch, "/api/v1/instruments/PETR4", map[string]any{"name": "Petrobras"}),
		http.StatusNotFound,
		"not_found",
		"",
	)
	h.ExpectProblem(
		h.Do(
			http.MethodPatch,
			"/api/v1/instruments/MXRF11",
			map[string]any{"name": "x", "exchange": "B3"},
		),
		http.StatusBadRequest,
		"invalid_request",
		"",
	)
}

func TestReconcileCurrencies(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	ctx := t.Context()

	count := func() int {
		var n int
		if err := h.Pool.QueryRow(ctx, `SELECT count(*) FROM marketdata_instrument WHERE instrument_type = 'currency'`).
			Scan(&n); err != nil {
			t.Fatal(err)
		}

		return n
	}
	if got, want := count(), len(money.Currencies()); got != want {
		t.Fatalf("currency instruments = %d, want %d", got, want)
	}

	if _, err := h.Pool.Exec(
		ctx,
		`UPDATE marketdata_instrument SET name = 'Custom' WHERE code = 'EUR'`,
	); err != nil {
		t.Fatal(err)
	}

	if err := h.App.Marketdata.ReconcileCurrencies(ctx); err != nil {
		t.Fatal(err)
	}

	var name string
	if err := h.Pool.QueryRow(ctx, `SELECT name FROM marketdata_instrument WHERE code = 'EUR'`).
		Scan(&name); err != nil {
		t.Fatal(err)
	}

	if name != "Custom" {
		t.Errorf("EUR name = %q, want Custom", name)
	}
}

func TestInstrumentSubtype(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	cri := map[string]any{
		"code":           "CRIXPTO",
		"type":           "fixed_income",
		"scale":          2,
		"name":           "CRI Xpto",
		"quote_currency": "BRL",
		"subtype":        "cri",
	}
	var got instrumentAPI
	h.MustDo(http.MethodPost, "/api/v1/instruments", cri, http.StatusCreated, &got)

	if got.Subtype != "cri" {
		t.Fatalf("created = %+v", got)
	}

	var read instrumentAPI
	h.MustDo(http.MethodGet, "/api/v1/instruments/CRIXPTO", nil, http.StatusOK, &read)

	if read.Subtype != "cri" {
		t.Fatalf("read = %+v", read)
	}

	var plain instrumentAPI
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, &plain)

	if plain.Subtype != "" {
		t.Fatalf("an instrument without subtype read %+v", plain)
	}

	var raw map[string]any
	h.MustDo(http.MethodGet, "/api/v1/instruments/MXRF11", nil, http.StatusOK, &raw)

	if _, ok := raw["subtype"]; ok {
		t.Fatalf("subtype present on an instrument without one: %v", raw)
	}

	for _, bad := range []string{"CRI", "a-b", "x", ""} {
		body := map[string]any{
			"code":           "BADONE",
			"type":           "fixed_income",
			"scale":          2,
			"name":           "Bad",
			"quote_currency": "BRL",
			"subtype":        bad,
		}
		h.ExpectProblem(
			h.Do(http.MethodPost, "/api/v1/instruments", body),
			http.StatusBadRequest,
			"invalid_request",
			"subtype",
		)
	}
}

// S365: symbols are stored with the instrument, replaced by an edit that carries them, kept by one
// that omits them, and checked against the sources that read a symbol (MQ20).
func TestInstrumentSymbols(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.As(usProfile()))
	path := "/api/v1/instruments/BRK.B"
	symbolsOf := func(r apitest.Response) map[string]string {
		var got struct {
			Symbols map[string]string `json:"symbols"`
		}
		r.Decode(t, &got)

		return got.Symbols
	}
	keep := map[string]any{"name": "Berkshire B", "exchange": "XNYS"}
	want := map[string]string{"yahoo_chart": "BRK-B"}

	r := h.Do(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code":           "BRK.B",
		"type":           "stock",
		"scale":          0,
		"name":           "Berkshire B",
		"quote_currency": "USD",
		"exchange":       "XNYS",
		"symbols":        want,
	})
	if r.Status != http.StatusCreated {
		t.Fatalf("define status = %d: %s", r.Status, r.Body)
	}

	if got := symbolsOf(r); !maps.Equal(got, want) {
		t.Fatalf("defined symbols = %v, want %v", got, want)
	}

	if got := symbolsOf(h.Do(http.MethodGet, path, nil)); !maps.Equal(got, want) {
		t.Fatalf("read symbols = %v, want %v", got, want)
	}

	if got := symbolsOf(h.Do(http.MethodPatch, path, keep)); !maps.Equal(got, want) {
		t.Fatalf("symbols after an edit without symbols = %v, want %v", got, want)
	}

	cleared := h.Do(
		http.MethodPatch,
		path,
		map[string]any{"name": "Berkshire B", "exchange": "XNYS", "symbols": map[string]string{}},
	)
	if cleared.Status != http.StatusOK || len(symbolsOf(cleared)) != 0 ||
		strings.Contains(string(cleared.Body), `"symbols"`) {
		t.Fatalf("clear status = %d: %s", cleared.Status, cleared.Body)
	}

	h.ExpectProblem(
		h.Do(
			http.MethodPatch,
			path,
			map[string]any{"name": "Berkshire B", "symbols": map[string]string{"ecb": "X"}},
		),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"symbols.ecb",
	)

	if got := h.Do(http.MethodGet, path, nil); strings.Contains(string(got.Body), `"symbols"`) {
		t.Fatalf("read after the rejected edit: %s", got.Body)
	}

	h.ExpectProblem(
		h.Do(
			http.MethodPatch,
			path,
			map[string]any{
				"name":    "Berkshire B",
				"symbols": map[string]string{"yahoo_chart": "BRK B"},
			},
		),
		http.StatusBadRequest,
		"invalid_request",
		"",
	)
}

// A223 RM1, RM2: removing a security deletes it with its prices and leaves the others.
func TestS385DeleteInstrument(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)
	other := mxrf11()
	other["code"] = "KNRI11"
	h.MustDo(http.MethodPost, "/api/v1/instruments", other, http.StatusCreated, nil)

	for _, code := range []string{"MXRF11", "KNRI11"} {
		h.MustDo(
			http.MethodPost,
			"/api/v1/prices",
			map[string]any{
				"instrument":       code,
				"quote_instrument": "BRL",
				"date":             "2026-10-22",
				"value":            "10.50",
			},
			http.StatusCreated,
			nil,
		)
	}

	if r := h.Do(
		http.MethodDelete,
		"/api/v1/instruments/MXRF11",
		nil,
	); r.Status != http.StatusNoContent {
		t.Fatalf("delete status = %d: %s", r.Status, r.Body)
	}

	h.ExpectProblem(
		h.Do(http.MethodGet, "/api/v1/instruments/MXRF11", nil),
		http.StatusNotFound,
		"not_found",
		"",
	)

	var prices struct {
		Items []priceAPI `json:"items"`
	}
	h.MustDo(
		http.MethodGet,
		"/api/v1/prices?instrument=KNRI11&quote_instrument=BRL&from=2026-10-01&to=2026-10-31",
		nil,
		http.StatusOK,
		&prices,
	)

	if len(prices.Items) != 1 {
		t.Fatalf("prices of the other instrument = %+v, want 1", prices.Items)
	}

	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)
	h.MustDo(
		http.MethodGet,
		"/api/v1/prices?instrument=MXRF11&quote_instrument=BRL&from=2026-10-01&to=2026-10-31",
		nil,
		http.StatusOK,
		&prices,
	)

	if len(prices.Items) != 0 {
		t.Fatalf("prices of the redefined instrument = %+v, want none", prices.Items)
	}

	h.ExpectProblem(
		h.Do(http.MethodDelete, "/api/v1/instruments/PETR4", nil),
		http.StatusNotFound,
		"not_found",
		"",
	)
	h.ExpectProblem(
		h.Do(http.MethodDelete, "/api/v1/instruments/BRL", nil),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"code",
	)
}

// A223 RM3: a security that an account holds cannot be removed, and nothing of it is deleted.
func TestS386DeleteInstrumentInUse(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)
	h.MustDo(
		http.MethodPost,
		"/api/v1/prices",
		map[string]any{
			"instrument":       "MXRF11",
			"quote_instrument": "BRL",
			"date":             "2026-10-22",
			"value":            "10.50",
		},
		http.StatusCreated,
		nil,
	)

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

	var prices struct {
		Items []priceAPI `json:"items"`
	}
	h.MustDo(
		http.MethodGet,
		"/api/v1/prices?instrument=MXRF11&quote_instrument=BRL&from=2026-10-01&to=2026-10-31",
		nil,
		http.StatusOK,
		&prices,
	)

	if len(prices.Items) != 1 {
		t.Fatalf("prices after the refusal = %+v, want 1", prices.Items)
	}
}

// A223 B2: removing a security writes to the instance's market data, a writer role.
func TestDeleteInstrumentRoles(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)

	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")
	h.ExpectProblem(
		h.Call(reader, http.MethodDelete, "/api/v1/instruments/MXRF11", nil),
		http.StatusForbidden,
		"book_role_required",
		"",
	)
	h.ExpectProblem(
		h.Call(&http.Client{}, http.MethodDelete, "/api/v1/instruments/MXRF11", nil),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)
}

// S410: editing replaces the type among stock, etf, reit and depositary_receipt and keeps the
// scale and the prices (amendment A224).
func TestS410ReclassifyInstrument(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)
	h.MustDo(
		http.MethodPost,
		"/api/v1/prices",
		map[string]any{
			"instrument":       "MXRF11",
			"quote_instrument": "BRL",
			"date":             "2026-10-22",
			"value":            "10.50",
		},
		http.StatusCreated,
		nil,
	)

	var got instrumentAPI
	h.MustDo(
		http.MethodPatch,
		"/api/v1/instruments/MXRF11",
		map[string]any{"type": "etf", "name": "Maxi Renda", "exchange": "BVMF"},
		http.StatusOK,
		&got,
	)

	want := instrumentAPI{
		Code:          "MXRF11",
		Type:          "etf",
		Scale:         0,
		Name:          "Maxi Renda",
		QuoteCurrency: "BRL",
		Exchange:      "BVMF",
	}
	if got != want {
		t.Fatalf("edited = %+v, want %+v", got, want)
	}

	var read instrumentAPI
	h.MustDo(http.MethodGet, "/api/v1/instruments/MXRF11", nil, http.StatusOK, &read)

	if read != want {
		t.Fatalf("read = %+v, want %+v", read, want)
	}

	var prices struct {
		Items []priceAPI `json:"items"`
	}
	h.MustDo(
		http.MethodGet,
		"/api/v1/prices?instrument=MXRF11&quote_instrument=BRL&from=2026-10-01&to=2026-10-31",
		nil,
		http.StatusOK,
		&prices,
	)

	if len(prices.Items) != 1 {
		t.Fatalf("prices = %+v", prices.Items)
	}
}

// S411: a type outside the four types of scale 0, as source or as target, is refused and the
// stored type stays (amendment A224).
func TestS411ReclassifyRefusals(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.MustDo(http.MethodPost, "/api/v1/instruments", mxrf11(), http.StatusCreated, nil)
	h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		map[string]any{
			"code":           "CDBXPTO",
			"type":           "fixed_income",
			"scale":          2,
			"name":           "CDB",
			"quote_currency": "BRL",
		},
		http.StatusCreated,
		nil,
	)

	tests := []struct {
		name, code, typ string
	}{
		{"to fund", "MXRF11", "fund"},
		{"to crypto", "MXRF11", "crypto"},
		{"to fixed_income", "MXRF11", "fixed_income"},
		{"from fixed_income", "CDBXPTO", "stock"},
		{"to currency", "MXRF11", "currency"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			h.ExpectProblem(
				h.Do(
					http.MethodPatch,
					"/api/v1/instruments/"+tc.code,
					map[string]any{"type": tc.typ, "name": "x"},
				),
				http.StatusUnprocessableEntity,
				"validation_failed",
				"type",
			)
		})
	}

	h.ExpectProblem(
		h.Do(
			http.MethodPatch,
			"/api/v1/instruments/MXRF11",
			map[string]any{"type": "bond", "name": "x"},
		),
		http.StatusBadRequest,
		"invalid_request",
		"",
	)

	var read instrumentAPI
	h.MustDo(http.MethodGet, "/api/v1/instruments/MXRF11", nil, http.StatusOK, &read)

	if read.Type != "reit" {
		t.Fatalf("type = %q, want reit", read.Type)
	}
}

// S414: a stored share whose name says it is an ETF or a FII is listed with the type the name
// says, and applying the list edits the types and leaves the other shares alone (amendment A226).
func TestS414TypeFixes(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	for _, in := range []struct{ code, name, typ string }{
		{"BOVA11", "ISHARES IBOVESPA CLASSE DE ÍNDICE - RESPONSABILIDADE LIMITADA", "stock"},
		{"MXRF11", "Maxi Renda Fundo De Investimento Imobiliaro - FII", "stock"},
		{"PETR4", "Petróleo Brasileiro S.A. - Petrobras", "stock"},
		{"KNRI11", "Kinea Renda Imobiliária Fundo de Investimento Imobiliário", "reit"},
	} {
		body := mxrf11()
		body["code"], body["name"], body["type"] = in.code, in.name, in.typ
		h.MustDo(http.MethodPost, "/api/v1/instruments", body, http.StatusCreated, nil)
	}

	md := h.App.Marketdata

	fixes, err := md.SuggestTypeFixes(t.Context())
	if err != nil {
		t.Fatal(err)
	}

	got := make([]string, len(fixes))
	for i, f := range fixes {
		got[i] = string(f.Code) + " " + f.From + " " + f.To
	}

	if want := []string{"BOVA11 stock etf", "MXRF11 stock reit"}; !slices.Equal(got, want) {
		t.Fatalf("fixes = %v, want %v", got, want)
	}

	if err := md.ApplyTypeFixes(t.Context(), fixes); err != nil {
		t.Fatal(err)
	}

	for code, want := range map[string]string{
		"BOVA11": "etf", "MXRF11": "reit", "PETR4": "stock", "KNRI11": "reit",
	} {
		var read instrumentAPI
		h.MustDo(http.MethodGet, "/api/v1/instruments/"+code, nil, http.StatusOK, &read)

		if read.Type != want || read.Exchange != "BVMF" {
			t.Errorf("%s = %+v, want type %s on BVMF", code, read, want)
		}
	}

	if again, err := md.SuggestTypeFixes(t.Context()); err != nil || len(again) != 0 {
		t.Fatalf("after the fix: %v, %v", again, err)
	}
}

func TestS419OddLotInstrumentIsRefused(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	r := h.Do(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code":           "PIBB11F",
		"type":           "etf",
		"scale":          0,
		"name":           "PIBB11F",
		"quote_currency": "BRL",
		"exchange":       "BVMF",
	})
	if r.Status != http.StatusUnprocessableEntity {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	var p struct {
		Code   string `json:"code"`
		Detail string `json:"detail"`
	}
	r.Decode(t, &p)

	if p.Code != "odd_lot_code" ||
		p.Detail != "PIBB11F is PIBB11 traded in the odd-lot market; register PIBB11" {
		t.Fatalf("problem = %+v: %s", p, r.Body)
	}

	h.ExpectProblem(
		h.Do(http.MethodGet, "/api/v1/instruments/PIBB11F", nil),
		http.StatusNotFound,
		"not_found",
		"",
	)
}

func TestResolveCode(t *testing.T) {
	t.Parallel()
	md := marketdata.New(pgtest.New(t))

	ctx := t.Context()
	if _, err := md.DefineInstrument(ctx, marketdata.Instrument{
		Code:          "PIBB11",
		Type:          "etf",
		Name:          "PIBB11",
		QuoteCurrency: "BRL",
		Exchange:      "BVMF",
	}); err != nil {
		t.Fatal(err)
	}

	tests := []struct{ code, want string }{
		{"PIBB11F", "PIBB11"},
		{"PIBB11", "PIBB11"},
		{"VALE3F", "VALE3F"},
	}

	for _, tc := range tests {
		got, err := md.ResolveCode(ctx, tc.code)
		if err != nil || got != tc.want {
			t.Errorf("ResolveCode(%q) = (%q, %v), want %q", tc.code, got, err, tc.want)
		}
	}
}

func TestSettlementDate(t *testing.T) {
	t.Parallel()
	md := marketdata.New(pgtest.New(t))

	ctx := t.Context()
	for code, exchange := range map[string]string{"PETR4": "BVMF", "AAPL": "XNAS"} {
		if _, err := md.DefineInstrument(ctx, marketdata.Instrument{
			Code:          money.Currency(code),
			Type:          "stock",
			Name:          code,
			QuoteCurrency: "BRL",
			Exchange:      exchange,
		}); err != nil {
			t.Fatal(err)
		}
	}

	tests := []struct{ name, code, date, want string }{
		{"B3 holiday inside the cycle", "PETR4", "2026-11-19", "2026-11-24"},
		{"B3 over a weekend", "PETR4", "2026-11-13", "2026-11-17"},
		{"exchange without a cycle", "AAPL", "2026-11-19", "2026-11-19"},
	}

	for _, tc := range tests {
		date, err := time.Parse(time.DateOnly, tc.date)
		if err != nil {
			t.Fatal(err)
		}

		got, err := md.SettlementDate(ctx, tc.code, date)
		if err != nil || got.Format(time.DateOnly) != tc.want {
			t.Errorf("%s: SettlementDate(%s, %s) = (%s, %v), want %s",
				tc.name, tc.code, tc.date, got.Format(time.DateOnly), err, tc.want)
		}
	}
}

func ownContract(code string) marketdata.Instrument {
	return marketdata.Instrument{
		Code:          money.Currency(code),
		Type:          "fixed_income",
		Name:          code,
		QuoteCurrency: "BRL",
	}
}

func TestDefineOwnInstrumentRefusesAnotherType(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	in := ownContract("RF.280302.CS3YS")
	in.Type = "stock"

	_, err := h.App.Marketdata.DefineOwnInstrument(t.Context(), h.OwnerID(), in)

	var fe *domain.FieldError
	if !errors.As(err, &fe) || fe.Field != "type" ||
		fe.Message != "must be fixed_income for a book's instrument" {
		t.Fatalf("err = %v, want field type", err)
	}
}

// S474: the deletion of a book removes its instruments with their terms and prices.
func TestS474BookDeletionRemovesItsInstruments(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	md := h.App.Marketdata
	ctx := t.Context()
	booksID := h.OwnerID()

	if _, err := md.DefineOwnInstrument(ctx, booksID, ownContract("RF.280302.CS3YS")); err != nil {
		t.Fatal(err)
	}

	if _, err := md.PutTerms(ctx, "RF.280302.CS3YS", marketdata.Terms{
		IssuedOn:         day("2026-03-02"),
		MaturesOn:        day("2028-03-02"),
		IndexID:          "cdi",
		PercentOfIndexBP: 11000,
		DayCount:         "bus252",
		FaceValue:        100000,
	}); err != nil {
		t.Fatal(err)
	}

	value, err := money.ParseRate("101.5")
	if err != nil {
		t.Fatal(err)
	}

	if err := md.RecordPrices(ctx, booksID, []marketdata.Price{{
		Instrument: "RF.280302.CS3YS",
		Quote:      "BRL",
		Date:       day("2026-10-30"),
		Value:      value,
		Source:     "manual",
	}}); err != nil {
		t.Fatal(err)
	}

	if _, err := h.Pool.Exec(ctx, `DELETE FROM identity_books WHERE id = $1`, booksID); err != nil {
		t.Fatal(err)
	}

	var instruments, terms, prices, brl int
	if err := h.Pool.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM marketdata_instrument WHERE code = 'RF.280302.CS3YS'),
		(SELECT count(*) FROM marketdata_fixed_income_terms WHERE instrument_code = 'RF.280302.CS3YS'),
		(SELECT count(*) FROM marketdata_price WHERE instrument = 'RF.280302.CS3YS'),
		(SELECT count(*) FROM marketdata_instrument WHERE code = 'BRL')`).
		Scan(&instruments, &terms, &prices, &brl); err != nil {
		t.Fatal(err)
	}

	if instruments != 0 || terms != 0 || prices != 0 || brl != 1 {
		t.Fatalf("rows = %d %d %d, BRL = %d; want 0 0 0 and 1", instruments, terms, prices, brl)
	}
}

type ownedInstrumentAPI struct {
	Code   string `json:"code"`
	Owned  bool   `json:"owned"`
	Issuer struct {
		Name   string `json:"name"`
		Scheme string `json:"scheme"`
		ID     string `json:"id"`
	} `json:"issuer"`
}

// ownedByA defines the contract of the owner's book with its terms.
func ownedByA(t *testing.T, h *apitest.Harness) {
	t.Helper()

	if _, err := h.App.Marketdata.DefineOwnInstrument(
		t.Context(), h.OwnerID(), ownContract("RF.280302.CS3YS"),
	); err != nil {
		t.Fatal(err)
	}

	if _, err := h.App.Marketdata.PutTerms(t.Context(), "RF.280302.CS3YS", marketdata.Terms{
		IssuedOn:         day("2026-03-02"),
		MaturesOn:        day("2028-03-02"),
		IndexID:          "cdi",
		PercentOfIndexBP: 11000,
		DayCount:         "bus252",
		FaceValue:        100000,
	}); err != nil {
		t.Fatal(err)
	}
}

// S471: a book reads, edits, prices and deletes only the contracts it can see.
func TestS471AnotherBooksInstrumentIsAbsent(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	ownedByA(t, h)

	csv := func(code string) string {
		return "instrument,quote_instrument,date,value\n" + code + ",BRL,2026-10-30,101.5\n"
	}
	terms := map[string]any{
		"issued_on": "2026-03-02", "matures_on": "2028-03-02", "day_count": "bus252",
		"face_value": 100000, "index_id": "cdi", "percent_of_index_bp": 11000,
	}
	rows := []struct {
		operation string
		status    int
		do        func(c *http.Client, code string) apitest.Response
	}{
		{"getInstrument", http.StatusOK, func(c *http.Client, code string) apitest.Response {
			return h.Call(c, http.MethodGet, "/api/v1/instruments/"+code, nil)
		}},
		{"editInstrument", http.StatusOK, func(c *http.Client, code string) apitest.Response {
			return h.Call(
				c,
				http.MethodPatch,
				"/api/v1/instruments/"+code,
				map[string]any{"name": "CDB"},
			)
		}},
		{"getInstrumentTerms", http.StatusOK, func(c *http.Client, code string) apitest.Response {
			return h.Call(c, http.MethodGet, "/api/v1/instruments/"+code+"/terms", nil)
		}},
		{"putInstrumentTerms", http.StatusOK, func(c *http.Client, code string) apitest.Response {
			return h.Call(c, http.MethodPut, "/api/v1/instruments/"+code+"/terms", terms)
		}},
		{
			"requestInstrumentHistory",
			http.StatusUnprocessableEntity,
			func(c *http.Client, code string) apitest.Response {
				return h.Call(
					c,
					http.MethodPost,
					"/api/v1/instruments/"+code+"/history",
					map[string]any{"from": "2026-03-02"},
				)
			},
		},
		{
			"recordInstrumentPrices",
			http.StatusOK,
			func(c *http.Client, code string) apitest.Response {
				return h.Call(
					c,
					http.MethodPost,
					"/api/v1/instruments/"+code+"/prices",
					map[string]any{
						"quote_instrument": "BRL",
						"prices": []map[string]any{
							{"date": "2026-10-29", "value": "101"},
						},
					},
				)
			},
		},
		{"listPrices", http.StatusOK, func(c *http.Client, code string) apitest.Response {
			return h.Call(c, http.MethodGet,
				"/api/v1/prices?instrument="+code+"&quote_instrument=BRL"+
					"&from=2026-10-01&to=2026-10-31", nil)
		}},
		{"recordPrice", http.StatusCreated, func(c *http.Client, code string) apitest.Response {
			return h.Call(c, http.MethodPost, "/api/v1/prices", map[string]any{
				"instrument": code, "quote_instrument": "BRL",
				"date": "2026-10-28", "value": "100",
			})
		}},
		{"importPrices", http.StatusOK, func(c *http.Client, code string) apitest.Response {
			return h.UploadAs(c, "/api/v1/prices/import", nil, "prices.csv", []byte(csv(code)))
		}},
		{
			"deleteInstrument",
			http.StatusNoContent,
			func(c *http.Client, code string) apitest.Response {
				return h.Call(c, http.MethodDelete, "/api/v1/instruments/"+code, nil)
			},
		},
	}

	covered := map[string]bool{}
	for _, row := range rows {
		covered[row.operation] = true
	}

	for _, op := range codeOperations(t) {
		if !covered[op] {
			t.Errorf("operation %s has a {code} and no row in the table", op)
		}
	}

	other := h.Login("other@example.com")

	// The gate answers for another book's contract as for a code that does not exist.
	for _, row := range rows {
		want := row.do(other, "RF.999999.ZZZZZ")
		got := row.do(other, "RF.280302.CS3YS")

		if got.Status != want.Status || problemCode(got) != problemCode(want) {
			t.Errorf("%s of another book's contract = %d %q, want %d %q of an unknown code",
				row.operation, got.Status, problemCode(got), want.Status, problemCode(want))
		}

		if want.Status < 400 {
			t.Errorf("%s of an unknown code = %d, want an error", row.operation, want.Status)
		}
	}

	for _, row := range rows {
		if got := row.do(h.Client, "RF.280302.CS3YS"); got.Status != row.status {
			t.Errorf("%s by the owning book = %d, want %d: %s",
				row.operation, got.Status, row.status, got.Body)
		}
	}
}

func problemCode(r apitest.Response) string {
	var p struct {
		Code string `json:"code"`
	}

	_ = json.Unmarshal(r.Body, &p)

	return p.Code
}

// codeOperations lists the operation IDs of the paths of openapi.yaml that hold {code}.
func codeOperations(t *testing.T) []string {
	t.Helper()

	content, err := os.ReadFile("openapi.yaml")
	if err != nil {
		t.Fatal(err)
	}

	var ops []string

	inCodePath := false

	for _, line := range strings.Split(string(content), "\n") {
		switch {
		case strings.HasPrefix(line, "  /"):
			inCodePath = strings.Contains(line, "{code}")
		case strings.HasPrefix(line, "schemas:"):
			inCodePath = false
		case inCodePath && strings.HasPrefix(line, "      operationId: "):
			ops = append(ops, strings.TrimPrefix(line, "      operationId: "))
		}
	}

	if len(ops) == 0 {
		t.Fatal("openapi.yaml has no operation with {code}")
	}

	return ops
}

// S472: a book lists the public instruments and its own.
func TestS472BookListsPublicAndOwn(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	ownedByA(t, h)
	h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument": "RF.280302.CS3YS", "quote_instrument": "BRL",
		"date": "2026-10-28", "value": "100",
	}, http.StatusCreated, nil)

	list := func(c *http.Client) map[string]bool {
		var out struct {
			Items []ownedInstrumentAPI `json:"items"`
		}

		r := h.Call(c, http.MethodGet, "/api/v1/instruments", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status %d: %s", r.Status, r.Body)
		}

		r.Decode(t, &out)

		got := map[string]bool{}
		for _, in := range out.Items {
			got[in.Code] = in.Owned
		}

		return got
	}

	a := list(h.Client)
	if owned, ok := a["RF.280302.CS3YS"]; !ok || !owned {
		t.Errorf("book A lists RF.280302.CS3YS owned = %v, %v; want true, true", owned, ok)
	}

	if owned, ok := a["BRL"]; !ok || owned {
		t.Errorf("book A lists BRL owned = %v, %v; want false, true", owned, ok)
	}

	other := h.Login("other@example.com")

	b := list(other)
	if _, ok := b["RF.280302.CS3YS"]; ok {
		t.Error("book B lists the contract of book A")
	}

	if _, ok := b["BRL"]; !ok {
		t.Error("book B does not list BRL")
	}

	quotes := func(c *http.Client) []string {
		var out struct {
			Items []struct {
				Instrument string `json:"instrument"`
			} `json:"items"`
		}

		r := h.Call(c, http.MethodGet, "/api/v1/instrument-quotes?base=BRL", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status %d: %s", r.Status, r.Body)
		}

		r.Decode(t, &out)

		codes := []string{}
		for _, q := range out.Items {
			codes = append(codes, q.Instrument)
		}

		return codes
	}

	if !slices.Contains(quotes(h.Client), "RF.280302.CS3YS") {
		t.Error("book A has no quote row of its contract")
	}

	if slices.Contains(quotes(other), "RF.280302.CS3YS") {
		t.Error("book B has a quote row of the contract of book A")
	}
}

// S476: the issuer of a contract is stored with its identifier in canonical form.
func TestS476InstrumentIssuer(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	ownedByA(t, h)

	var got ownedInstrumentAPI
	h.MustDo(http.MethodPatch, "/api/v1/instruments/RF.280302.CS3YS", map[string]any{
		"name": "RF.280302.CS3YS",
		"issuer": map[string]any{
			"name": "Banco X", "scheme": "br_cnpj", "id": "11.222.333/0001-81",
		},
	}, http.StatusOK, &got)

	if got.Issuer.Name != "Banco X" || got.Issuer.Scheme != "br_cnpj" ||
		got.Issuer.ID != "11222333000181" {
		t.Errorf("issuer = %+v, want Banco X br_cnpj 11222333000181", got.Issuer)
	}

	h.ExpectProblem(
		h.Do(http.MethodPatch, "/api/v1/instruments/RF.280302.CS3YS", map[string]any{
			"name":   "RF.280302.CS3YS",
			"issuer": map[string]any{"name": "Banco X", "scheme": "us_ein", "id": "12-3456789"},
		}),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"issuer.scheme",
	)

	de := apitest.New(t, apitest.As(apitest.Profile{
		Name:   "germany",
		Locale: locale.Locale{Language: "de", Region: "DE"},
		Base:   "EUR",
	}))
	de.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "DE0001102580", "type": "fixed_income", "scale": 0, "name": "Bund",
		"quote_currency": "EUR", "issuer": map[string]any{"name": "Bund"},
	}, http.StatusCreated, nil)
}
