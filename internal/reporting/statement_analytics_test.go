package reporting_test

import (
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type parts struct {
	Purchases    int64
	Installments int64
	Charges      int64
	Credits      int64
	Total        int64
}

type money struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}

type partsView struct {
	Purchases    money `json:"purchases"`
	Installments money `json:"installments"`
	Charges      money `json:"charges"`
	Credits      money `json:"credits"`
	Total        money `json:"total"`
}

func (v partsView) parts(t *testing.T) parts {
	t.Helper()
	for _, m := range []money{v.Purchases, v.Installments, v.Charges, v.Credits, v.Total} {
		if m.Currency != "BRL" {
			t.Errorf("currency = %q, want BRL", m.Currency)
		}
	}
	return parts{v.Purchases.Amount, v.Installments.Amount, v.Charges.Amount, v.Credits.Amount, v.Total.Amount}
}

func (c card) statementID(t *testing.T, reference string) string {
	t.Helper()
	var out struct {
		Items []struct {
			ID        string `json:"id"`
			Reference string `json:"reference"`
		} `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/statements?from=2026-01&to=2027-12", nil, http.StatusOK, &out)
	for _, s := range out.Items {
		if s.Reference == reference {
			return s.ID
		}
	}
	t.Fatalf("no statement %s", reference)
	return ""
}

// S148: each number of the analysis of statement 2026-12, and the card's closed statements.
func TestS148(t *testing.T) {
	t.Parallel()
	c := newCard(t)
	var accounts struct {
		Items []struct {
			ID         string `json:"id"`
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &accounts)
	var fees string
	for _, a := range accounts.Items {
		if a.SystemRole == "fees" {
			fees = a.ID
		}
	}
	market := c.h.Record("2026-11-20", apitest.Posting(c.card, -15000), apitest.Posting(c.supermarket, 15000))
	c.h.MustDo(http.MethodPost, "/api/v1/transactions/"+market+"/refunds", map[string]any{"date": "2026-11-25", "amount": apitest.BRL(2000)}, http.StatusCreated, nil)
	c.h.Record("2026-12-01", apitest.Posting(c.card, -4000), apitest.Posting(fees, 4000))

	var got struct {
		StatementID string `json:"statement_id"`
		Reference   string `json:"reference"`
		partsView
		Categories []struct {
			CategoryID string `json:"category_id"`
			partsView
		} `json:"categories"`
	}
	december := c.statementID(t, "2026-12")
	c.h.MustDo(http.MethodGet, "/api/v1/statements/"+december+"/analytics", nil, http.StatusOK, &got)
	if got.StatementID != december || got.Reference != "2026-12" {
		t.Errorf("statement = %s %s", got.StatementID, got.Reference)
	}
	if p := got.parts(t); p != (parts{Purchases: 15000, Installments: 33333, Charges: 4000, Credits: -2000, Total: 50333}) {
		t.Errorf("totals = %+v", p)
	}
	categories := map[string]parts{}
	for _, row := range got.Categories {
		categories[row.CategoryID] = row.parts(t)
	}
	want := map[string]parts{
		c.electronics: {Installments: 33333, Total: 33333},
		c.supermarket: {Purchases: 15000, Credits: -2000, Total: 13000},
		fees:          {Charges: 4000, Total: 4000},
	}
	if !reflect.DeepEqual(categories, want) {
		t.Errorf("categories = %+v, want %+v", categories, want)
	}
	if len(got.Categories) != 3 || got.Categories[0].CategoryID != c.electronics || got.Categories[1].CategoryID != c.supermarket {
		t.Errorf("order = %+v, want by total, largest first", got.Categories)
	}

	var history struct {
		Items []struct {
			Reference string `json:"reference"`
			partsView
		} `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/statement-analytics", nil, http.StatusOK, &history)
	gotHistory := map[string]parts{}
	var order []string
	for _, s := range history.Items {
		gotHistory[s.Reference] = s.parts(t)
		order = append(order, s.Reference)
	}
	wantHistory := map[string]parts{
		"2026-11": {Purchases: 56334, Total: 56334},
		"2026-12": {Purchases: 15000, Installments: 33333, Charges: 4000, Credits: -2000, Total: 50333},
		"2027-01": {Installments: 33333, Total: 33333},
	}
	if !reflect.DeepEqual(gotHistory, wantHistory) || !reflect.DeepEqual(order, []string{"2026-11", "2026-12", "2027-01"}) {
		t.Errorf("history = %v %+v, want %+v", order, gotHistory, wantHistory)
	}

	c.h.ExpectProblem(c.h.Do(http.MethodGet, "/api/v1/statements/"+c.laptop.ID+"/analytics", nil), http.StatusNotFound, "not_found", "")
	c.h.ExpectProblem(c.h.Do(http.MethodGet, "/api/v1/accounts/"+c.checking+"/statement-analytics", nil), http.StatusNotFound, "not_found", "")
}
