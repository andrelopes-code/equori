package capture_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type money struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}

type choiceView struct {
	AccountID   string `json:"account_id"`
	Amount      *money `json:"amount"`
	Description string `json:"description"`
}

type issueView struct {
	Code    string       `json:"code"`
	Field   string       `json:"field"`
	Choices []choiceView `json:"choices"`
}

type lineView struct {
	Line     int    `json:"line"`
	Text     string `json:"text"`
	Segments []struct {
		Text string `json:"text"`
		Role string `json:"role"`
	} `json:"segments"`
	Kind           string      `json:"kind"`
	Amount         *money      `json:"amount"`
	Date           string      `json:"date"`
	AccountID      string      `json:"account_id"`
	AccountSource  string      `json:"account_source"`
	ToAccountID    string      `json:"to_account_id"`
	Installments   int         `json:"installments"`
	Description    string      `json:"description"`
	PayeeID        string      `json:"payee_id"`
	CategoryID     string      `json:"category_id"`
	CategorySource string      `json:"category_source"`
	Tags           []string    `json:"tags"`
	Issues         []issueView `json:"issues"`
}

// books is the fixture of the capture scenarios (spec, section Scenarios).
type books struct {
	h                               *apitest.Harness
	checking, visa, wallet, reserve string
	supermarket, transport, uber    string
}

func newBooks(t *testing.T, opts ...apitest.Option) books {
	h := apitest.New(t, append([]apitest.Option{apitest.Today("2026-10-21")}, opts...)...)
	institution := func(name string) string {
		var out struct {
			ID string `json:"id"`
		}
		h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]any{"name": name}, http.StatusCreated, &out)
		return out.ID
	}
	nubank, itau := institution("Nubank"), institution("Itaú")
	b := books{
		h:           h,
		checking:    h.Account("Nubank checking", "asset", "checking", map[string]any{"institution_id": nubank}),
		visa:        h.Card("Itaú Visa", 3, 10, "next"),
		wallet:      h.Account("Wallet", "asset", "cash", nil),
		reserve:     h.Account("Emergency fund", "asset", "reserve", nil),
		supermarket: h.Account("Supermarket", "expense", "", nil),
		transport:   h.Account("Transport", "expense", "", nil),
	}
	h.MustDo(http.MethodPatch, "/api/v1/accounts/"+b.visa, map[string]any{"institution_id": itau}, http.StatusOK, nil)
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+b.visa+"/cards", map[string]any{"holder": "Owner", "last_four": "1234"}, http.StatusCreated, nil)
	h.MustDo(http.MethodPost, "/api/v1/rules", map[string]any{
		"name":       "Supermarket",
		"conditions": []any{map[string]any{"field": "description", "operator": "contains", "value": "mercado"}},
		"actions":    []any{map[string]any{"type": "set_category", "category_id": b.supermarket}},
	}, http.StatusCreated, nil)
	var payee struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/payees", map[string]any{"name": "Uber"}, http.StatusCreated, &payee)
	b.uber = payee.ID
	h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-01", "description": "ride", "payee_id": b.uber,
		"postings": []map[string]any{apitest.Posting(b.wallet, -1500), apitest.Posting(b.transport, 1500)},
	}, http.StatusCreated, nil)
	return b
}

func (b books) preview(t *testing.T, text, defaultAccount string) []lineView {
	t.Helper()
	body := map[string]any{"text": text}
	if defaultAccount != "" {
		body["default_account_id"] = defaultAccount
	}
	var out struct {
		Lines []lineView `json:"lines"`
	}
	b.h.MustDo(http.MethodPost, "/api/v1/capture/preview", body, http.StatusOK, &out)
	return out.Lines
}

func (b books) one(t *testing.T, text, defaultAccount string) lineView {
	t.Helper()
	lines := b.preview(t, text, defaultAccount)
	if len(lines) != 1 {
		t.Fatalf("lines = %d, want 1", len(lines))
	}
	return lines[0]
}

func codes(l lineView) string {
	var out []string
	for _, i := range l.Issues {
		out = append(out, i.Code)
	}
	return strings.Join(out, ",")
}

func amount(l lineView) int64 {
	if l.Amount == nil {
		return 0
	}
	return l.Amount.Amount
}

func TestPreviewScenarios(t *testing.T) {
	t.Parallel()
	b := newBooks(t)

	t.Run("S99", func(t *testing.T) {
		l := b.one(t, "ontem mercado 230 nubank checking", "")
		if l.Kind != "expense" || amount(l) != 23000 || l.Amount.Currency != "BRL" || l.Date != "2026-10-20" || l.AccountID != b.checking ||
			l.AccountSource != "text" || l.Description != "Mercado" || l.CategoryID != b.supermarket || l.CategorySource != "rule" || len(l.Issues) != 0 {
			t.Fatalf("line = %+v", l)
		}
	})
	t.Run("S100", func(t *testing.T) {
		lines := b.preview(t, "uber 32,50 itaú; ifood 58 3x final 1234", "")
		if len(lines) != 2 || lines[0].Line != 1 || lines[1].Line != 2 {
			t.Fatalf("lines = %+v", lines)
		}
		if l := lines[0]; l.AccountID != b.visa || amount(l) != 3250 || l.PayeeID != b.uber {
			t.Fatalf("first = %+v", l)
		}
		if l := lines[1]; l.AccountID != b.visa || amount(l) != 5800 || l.Installments != 3 || len(l.Issues) != 0 {
			t.Fatalf("second = %+v", l)
		}
	})
	t.Run("S101", func(t *testing.T) {
		if l := b.one(t, "notebook 3x de 1.200 itaú", ""); amount(l) != 360000 || l.Installments != 3 || l.AccountID != b.visa {
			t.Fatalf("line = %+v", l)
		}
	})
	t.Run("S102", func(t *testing.T) {
		l := b.one(t, "transferi 500 do nubank checking pra wallet", "")
		if l.Kind != "transfer" || amount(l) != 50000 || l.AccountID != b.checking || l.ToAccountID != b.wallet || l.CategoryID != "" {
			t.Fatalf("line = %+v", l)
		}
	})
	t.Run("S103", func(t *testing.T) {
		if l := b.one(t, "recebi 1.5k nubank checking", ""); l.Kind != "income" || amount(l) != 150000 || l.AccountID != b.checking {
			t.Fatalf("line = %+v", l)
		}
	})
	t.Run("S104", func(t *testing.T) {
		l := b.one(t, "padaria 2 irmãos 15 wallet", "")
		if codes(l) != "ambiguous_amount" || len(l.Issues[0].Choices) != 2 {
			t.Fatalf("line = %+v", l)
		}
		c := l.Issues[0].Choices
		if c[0].Amount.Amount != 200 || c[0].Description != "Padaria irmãos 15" || c[1].Amount.Amount != 1500 || c[1].Description != "Padaria 2 irmãos" {
			t.Fatalf("choices = %+v", c)
		}
	})
	t.Run("S105", func(t *testing.T) {
		if l := b.one(t, "cinema 40", ""); codes(l) != "missing_account" || l.AccountID != "" {
			t.Fatalf("line = %+v", l)
		}
		if l := b.one(t, "cinema 40", b.wallet); codes(l) != "" || l.AccountID != b.wallet || l.AccountSource != "default" {
			t.Fatalf("line = %+v", l)
		}
	})
	t.Run("S106", func(t *testing.T) {
		if l := b.one(t, "almoço 32 nubank", ""); l.AccountID != b.checking || codes(l) != "" {
			t.Fatalf("line = %+v", l)
		}
		if l := b.one(t, "almoço 32 itaú débito", ""); codes(l) != "unknown_account" {
			t.Fatalf("line = %+v", l)
		}
	})
	t.Run("S107", func(t *testing.T) {
		if l := b.one(t, "sexta 12,99 wallet", ""); l.Date != "2026-10-16" {
			t.Fatalf("line = %+v", l)
		}
	})
	t.Run("S108", func(t *testing.T) {
		if l := b.one(t, "31/02 50 wallet", ""); codes(l) != "invalid_date" || l.Issues[0].Field != "date" {
			t.Fatalf("line = %+v", l)
		}
	})
	t.Run("S109", func(t *testing.T) {
		if l := b.one(t, "mercado 45 3x wallet", ""); codes(l) != "installments_not_allowed" {
			t.Fatalf("line = %+v", l)
		}
	})
	t.Run("S110", func(t *testing.T) {
		if l := b.one(t, "taxi 30,999 wallet", ""); codes(l) != "invalid_amount" || l.Amount != nil {
			t.Fatalf("line = %+v", l)
		}
	})
	t.Run("payee history", func(t *testing.T) {
		l := b.one(t, "uber 30 wallet #trabalho", "")
		if l.PayeeID != b.uber || l.CategoryID != b.transport || l.CategorySource != "history" || len(l.Tags) != 1 || l.Tags[0] != "trabalho" {
			t.Fatalf("line = %+v", l)
		}
	})
	t.Run("a word one edit from a handle asks", func(t *testing.T) {
		l := b.one(t, "almoço 30 nubnak", b.wallet)
		if codes(l) != "possible_account" || l.AccountID != b.wallet || l.AccountSource != "default" {
			t.Fatalf("line = %+v", l)
		}
		c := l.Issues[0].Choices
		if len(c) != 2 || c[0].AccountID != b.checking || c[0].Description != "Almoço" || c[1].AccountID != b.wallet || c[1].Description != "Almoço nubnak" {
			t.Fatalf("choices = %+v", c)
		}
	})
	t.Run("three accounts", func(t *testing.T) {
		l := b.one(t, "200 wallet nubank itaú", "")
		if codes(l) != "too_many_accounts" {
			t.Fatalf("line = %+v", l)
		}
	})
	t.Run("segments join to the line", func(t *testing.T) {
		l := b.one(t, "  R$ 12 café   #manhã wallet ", "")
		var sb strings.Builder
		for _, s := range l.Segments {
			sb.WriteString(s.Text)
		}
		if sb.String() != l.Text || l.Text != "R$ 12 café   #manhã wallet" || l.Segments[0].Role != "amount" {
			t.Fatalf("segments = %+v", l.Segments)
		}
	})
	t.Run("blank text", func(t *testing.T) {
		if lines := b.preview(t, " \n;\n", ""); len(lines) != 0 {
			t.Fatalf("lines = %+v", lines)
		}
	})
}

func TestPreviewRejections(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	b.h.ExpectProblem(b.h.Do(http.MethodPost, "/api/v1/capture/preview", map[string]any{"text": strings.Repeat("café 5\n", 101)}),
		http.StatusUnprocessableEntity, "too_many_lines", "")
	b.h.ExpectProblem(b.h.Do(http.MethodPost, "/api/v1/capture/preview", map[string]any{"text": "café 5", "default_account_id": b.transport}),
		http.StatusUnprocessableEntity, "validation_failed", "default_account_id")
	b.h.ExpectProblem(b.h.Do(http.MethodPost, "/api/v1/capture/preview", map[string]any{"text": strings.Repeat("a", 10001)}),
		http.StatusBadRequest, "invalid_request", "text")
	if lines := b.preview(t, strings.Repeat("café 5\n\n", 100), b.wallet); len(lines) != 100 {
		t.Fatalf("lines = %d, want 100", len(lines))
	}
}

// A closed account and a parent account are never named; their words stay in the description.
func TestPreviewCandidates(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	old := b.h.Account("Old wallet", "asset", "cash", nil)
	b.h.MustDo(http.MethodPost, "/api/v1/accounts/"+old+"/close", map[string]string{"closed_on": "2026-10-15"}, http.StatusOK, nil)
	b.h.ExpectProblem(b.h.Do(http.MethodPost, "/api/v1/capture/preview", map[string]any{"text": "café 5", "default_account_id": old}),
		http.StatusUnprocessableEntity, "validation_failed", "default_account_id")
	if l := b.one(t, "café 5 old wallet", b.checking); l.AccountID != b.wallet || l.Description != "Café old" {
		t.Fatalf("line = %+v", l)
	}
}

// A128: the dates of a text written offline resolve against the day it was written.
func TestPreviewReferenceDate(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	at := func(t *testing.T, text, reference string) lineView {
		t.Helper()
		var out struct {
			Lines []lineView `json:"lines"`
		}
		b.h.MustDo(http.MethodPost, "/api/v1/capture/preview",
			map[string]any{"text": text, "default_account_id": b.wallet, "reference_date": reference}, http.StatusOK, &out)
		if len(out.Lines) != 1 {
			t.Fatalf("lines = %d, want 1", len(out.Lines))
		}
		return out.Lines[0]
	}
	t.Run("S151", func(t *testing.T) {
		if l := at(t, "mercado 30 ontem", "2026-10-18"); l.Date != "2026-10-17" {
			t.Fatalf("date = %s, want 2026-10-17", l.Date)
		}
	})
	t.Run("S152", func(t *testing.T) {
		if l := at(t, "mercado 30", "2026-10-18"); l.Date != "2026-10-18" {
			t.Fatalf("date = %s, want 2026-10-18", l.Date)
		}
	})
	t.Run("S153", func(t *testing.T) {
		if l := at(t, "mercado 30", "2026-10-22"); l.Date != "2026-10-22" {
			t.Fatalf("date = %s, want 2026-10-22 (today plus one day)", l.Date)
		}
		b.h.ExpectProblem(b.h.Do(http.MethodPost, "/api/v1/capture/preview",
			map[string]any{"text": "mercado 30", "reference_date": "2026-10-23"}),
			http.StatusUnprocessableEntity, "validation_failed", "reference_date")
	})
}
