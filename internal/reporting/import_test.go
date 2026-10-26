package reporting_test

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type books struct {
	checking, card, food, xp string
}

// populate records one fact of each kind the round trip covers (export design E6).
func populate(t *testing.T, h *apitest.Harness) books {
	t.Helper()
	b := books{
		checking: h.Account("Checking", "asset", "checking", nil),
		card:     h.Card("Visa", 3, 10, "next"),
		food:     h.Account("Food", "expense", "", nil),
	}
	rent := h.Account("Rent", "expense", "", nil)
	var tx struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-12", "description": "Mercado central", "tags": []string{"market"},
		"postings": []map[string]any{apitest.Posting(b.card, -23000), apitest.Posting(b.food, 23000)},
	}, http.StatusCreated, &tx)
	if r := h.Upload("/api/v1/transactions/"+tx.ID+"/attachments", "receipt.pdf", []byte("%PDF-1.4 receipt")); r.Status != http.StatusCreated {
		t.Fatalf("attachment = %d: %s", r.Status, r.Body)
	}
	h.MustDo(http.MethodPost, "/api/v1/installment-purchases", map[string]any{
		"card_account_id": b.card, "date": "2026-10-20",
		"splits":              []map[string]any{{"account_id": b.food, "amount": apitest.BRL(90000)}},
		"installment_count":   3,
		"installment_amounts": []map[string]any{apitest.BRL(30000), apitest.BRL(30000), apitest.BRL(30000)},
	}, http.StatusCreated, nil)
	h.Record("2026-10-05", apitest.Posting(b.checking, -150000), apitest.Posting(rent, 150000))
	h.MustDo(http.MethodPost, "/api/v1/schedules", map[string]any{
		"kind": "bill", "account_id": b.checking, "counterpart_id": rent, "description": "rent", "amount": apitest.BRL(150000),
		"recurrence": map[string]any{"frequency": "monthly", "interval": 1, "day_of_month": 5, "start": "2026-10-05"},
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/budgets", map[string]any{
		"category_id": b.food, "amount": apitest.BRL(200000), "effective_from": "2026-10", "rollover": false,
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/rules", map[string]any{
		"name":       "Market",
		"conditions": []any{map[string]any{"field": "description", "operator": "contains", "value": "mercado"}},
		"actions":    []any{map[string]any{"type": "set_category", "category_id": b.food}},
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "MXRF11", "type": "reit", "scale": 0, "name": "MXRF11", "quote_currency": "BRL", "exchange": "BVMF",
	}, http.StatusCreated, nil)
	b.xp = h.Account("XP", "asset", "brokerage", nil)
	cash := h.Account("XP cash", "asset", "brokerage", map[string]any{"parent_id": b.xp, "currency": "BRL"})
	fund := h.Account("XP MXRF11", "asset", "brokerage", map[string]any{"parent_id": b.xp, "currency": "MXRF11"})
	h.Record("2026-10-01", apitest.Posting(b.checking, -50000), apitest.Posting(cash, 50000))
	h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id": fund, "cash_account_id": cash, "side": "buy", "date": "2026-10-02",
		"quantity": map[string]any{"amount": 10, "currency": "MXRF11"}, "unit_price": "10.00",
	}, http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "MXRF11", "quote_instrument": "BRL", "date": "2026-10-23", "value": "10.40"}, http.StatusCreated, nil)
	h.Dispatch()
	return b
}

func zipOf(t *testing.T, files map[string][]byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	z := zip.NewWriter(&buf)
	for name, b := range files {
		w, err := z.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write(b); err != nil {
			t.Fatal(err)
		}
	}
	if err := z.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

const importPath = "/api/v1/imports/archive"

// N13: an export imported into an empty instance reproduces every fact and every derived value.
func TestExportImportRoundTrip(t *testing.T) {
	t.Parallel()
	source := apitest.New(t, apitest.Today("2026-10-26"))
	b := populate(t, source)
	first := export(t, source)

	target := apitest.New(t, apitest.Today("2026-10-26"))
	var out struct {
		Tables []struct {
			Name string `json:"name"`
			Rows int    `json:"rows"`
		} `json:"tables"`
	}
	r := target.Upload(importPath, "equori-export-2026-10-26.zip", first)
	if r.Status != http.StatusOK {
		t.Fatalf("import = %d: %s", r.Status, r.Body)
	}
	r.Decode(t, &out)
	if len(out.Tables) == 0 {
		t.Fatalf("import = %s", r.Body)
	}

	before, after := archive(t, first), archive(t, export(t, target))
	var m manifest
	if err := json.Unmarshal(before["manifest.json"], &m); err != nil {
		t.Fatal(err)
	}
	for _, table := range m.Tables {
		if strings.HasPrefix(table.Name, "marketdata_") {
			continue
		}
		if !bytes.Equal(before[table.File], after[table.File]) {
			t.Errorf("%s differs:\nexported %s\nreimported %s", table.Name, before[table.File], after[table.File])
		}
	}
	for _, a := range m.Attachments {
		if !bytes.Equal(before[a.File], after[a.File]) {
			t.Errorf("attachment %s differs", a.File)
		}
	}

	for _, path := range []string{
		"/api/v1/accounts?limit=200",
		"/api/v1/reports/net-worth?date=2026-10-26",
		"/api/v1/reports/categories?from=2026-10-01&to=2026-10-31&class=expense",
		"/api/v1/reports/balances?account_id=" + b.checking + "&from=2026-10-01&to=2026-10-26",
		"/api/v1/positions?date=2026-10-26",
		"/api/v1/accounts/" + b.card + "/commitments?month=2026-11",
	} {
		want, got := source.Do(http.MethodGet, path, nil), target.Do(http.MethodGet, path, nil)
		if want.Status != http.StatusOK || got.Status != http.StatusOK || !bytes.Equal(want.Body, got.Body) {
			t.Errorf("GET %s:\nsource %d %s\ntarget %d %s", path, want.Status, want.Body, got.Status, got.Body)
		}
	}
}

// Export design E4: what an import refuses writes nothing.
func TestImportRejects(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-26"))
	populate(t, h)
	good := export(t, h)
	files := archive(t, good)

	h.ExpectProblem(h.Upload(importPath, "a.zip", good), http.StatusConflict, "import_not_empty", "")
	other := h.Login("other@example.com")
	h.ExpectProblem(h.UploadAs(other, importPath, nil, "a.zip", good), http.StatusConflict, "import_conflict", "")

	empty := apitest.New(t, apitest.Today("2026-10-26"))
	h.ExpectProblem(empty.Upload(importPath, "a.zip", []byte("not a zip")), http.StatusUnprocessableEntity, "archive_invalid", "file")

	tampered := map[string][]byte{}
	for name, b := range files {
		tampered[name] = b
	}
	tampered["tables/ledger_posting.jsonl"] = append([]byte(nil), files["tables/ledger_posting.jsonl"][1:]...)
	empty.ExpectProblem(empty.Upload(importPath, "a.zip", zipOf(t, tampered)), http.StatusUnprocessableEntity, "archive_invalid", "file")

	var m map[string]any
	if err := json.Unmarshal(files["manifest.json"], &m); err != nil {
		t.Fatal(err)
	}
	m["schema_version"] = m["schema_version"].(float64) + 1
	newer := map[string][]byte{}
	for name, b := range files {
		newer[name] = b
	}
	newer["manifest.json"], _ = json.Marshal(m)
	empty.ExpectProblem(empty.Upload(importPath, "a.zip", zipOf(t, newer)), http.StatusUnprocessableEntity, "archive_version_mismatch", "file")

	m["schema_version"] = m["schema_version"].(float64) - 1
	tables := m["tables"].([]any)
	tables[0].(map[string]any)["name"] = "identity_user"
	foreign := map[string][]byte{}
	for name, b := range files {
		foreign[name] = b
	}
	foreign["manifest.json"], _ = json.Marshal(m)
	empty.ExpectProblem(empty.Upload(importPath, "a.zip", zipOf(t, foreign)), http.StatusUnprocessableEntity, "archive_invalid", "file")

	var accounts struct {
		Items []struct {
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	empty.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &accounts)
	for _, a := range accounts.Items {
		if a.SystemRole == "" {
			t.Errorf("a refused import wrote accounts: %+v", accounts.Items)
			break
		}
	}
}
