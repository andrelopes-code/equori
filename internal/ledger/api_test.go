package ledger_test

import (
	"fmt"
	"net/http"
	"net/url"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type idOnly struct {
	ID string `json:"id"`
}

func tx(date string, postings ...map[string]any) map[string]any {
	return map[string]any{"date": date, "description": "test", "postings": postings}
}

func TestCreateAccountAndRecordExpense(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)

	h.Record("2026-10-14", apitest.Posting(checking, -12000), apitest.Posting(food, 12000))

	var bal struct {
		Balance struct {
			Amount   int64  `json:"amount"`
			Currency string `json:"currency"`
		} `json:"balance"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+checking+"/balance?date=2026-10-31", nil, http.StatusOK, &bal)
	if bal.Balance.Amount != -12000 || bal.Balance.Currency != "BRL" {
		t.Fatalf("balance = %+v", bal)
	}
}

func TestValidationErrorsHaveFields(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", apitest.Posting(checking, 0), apitest.Posting(food, 0))),
		http.StatusUnprocessableEntity, "validation_failed", "postings[0].amount")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", apitest.Posting(checking, -9007199254740992), apitest.Posting(food, 9007199254740992))),
		http.StatusUnprocessableEntity, "validation_failed", "postings[0].amount")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", apitest.Posting(checking, -100), apitest.Posting(food, 90))),
		http.StatusUnprocessableEntity, "validation_failed", "postings")
}

func TestForeignAccountIs422(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	otherClient := h.Login("other@example.com")
	var other idOnly
	h.Call(otherClient, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Food", "class": "expense", "currency": "BRL"}).Decode(t, &other)

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", apitest.Posting(checking, -100), apitest.Posting(other.ID, 100))),
		http.StatusUnprocessableEntity, "invalid_account", "postings[1].account_id")
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/accounts/"+other.ID, nil), http.StatusNotFound, "not_found", "")
}

func TestCorrectionConflictIs409(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	id := h.Record("2026-10-14", apitest.Posting(checking, -100), apitest.Posting(food, 100))

	correction := tx("2026-10-14", apitest.Posting(checking, -200), apitest.Posting(food, 200))
	correction["expected_version"] = 1
	correction["reason"] = "typo"
	h.MustDo(http.MethodPut, "/api/v1/transactions/"+id, correction, http.StatusOK, nil)
	h.ExpectProblem(h.Do(http.MethodPut, "/api/v1/transactions/"+id, correction), http.StatusConflict, "version_conflict", "")

	var versions struct {
		Items []struct {
			Version int `json:"version"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+id+"/versions", nil, http.StatusOK, &versions)
	if len(versions.Items) != 1 || versions.Items[0].Version != 1 {
		t.Fatalf("versions = %+v", versions)
	}

	h.MustDo(http.MethodPost, "/api/v1/transactions/"+id+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/transactions/"+id+"/void", map[string]string{"reason": "again"}),
		http.StatusConflict, "transaction_voided", "")
}

func TestPaginationTies(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	for i := range 120 {
		h.Record(fmt.Sprintf("2026-10-%02d", 1+i%3), apitest.Posting(checking, -1), apitest.Posting(food, 1))
	}

	seen := map[string]bool{}
	pages := 0
	path := "/api/v1/transactions?limit=50"
	for {
		var page struct {
			Items      []idOnly `json:"items"`
			NextCursor string   `json:"next_cursor"`
		}
		h.MustDo(http.MethodGet, path, nil, http.StatusOK, &page)
		pages++
		for _, it := range page.Items {
			if seen[it.ID] {
				t.Fatalf("transaction %s on two pages", it.ID)
			}
			seen[it.ID] = true
		}
		if page.NextCursor == "" {
			break
		}
		path = "/api/v1/transactions?limit=50&cursor=" + url.QueryEscape(page.NextCursor)
	}
	if pages != 3 || len(seen) != 120 {
		t.Fatalf("pages = %d, distinct = %d; want 3 and 120", pages, len(seen))
	}
}

func TestInvalidCursorIs400(t *testing.T) {
	h := apitest.New(t)
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/transactions?cursor=abc", nil), http.StatusBadRequest, "invalid_request", "")
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/transactions?limit=500", nil), http.StatusBadRequest, "invalid_request", "")
}

func TestSettingsLockAfterFirstTransaction(t *testing.T) {
	h := apitest.New(t)
	h.MustDo(http.MethodPut, "/api/v1/settings", map[string]string{"base_currency": "USD"}, http.StatusOK, nil)
	h.MustDo(http.MethodPut, "/api/v1/settings", map[string]string{"base_currency": "BRL"}, http.StatusOK, nil)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-14", apitest.Posting(checking, -100), apitest.Posting(food, 100))

	h.ExpectProblem(h.Do(http.MethodPut, "/api/v1/settings", map[string]string{"base_currency": "USD"}), http.StatusConflict, "settings_locked", "")
}

func TestUnauthenticated(t *testing.T) {
	h := apitest.New(t)
	anonymous := &http.Client{}
	for _, p := range []string{"/api/v1/accounts", "/api/v1/transactions", "/api/v1/settings", "/api/v1/payees", "/api/v1/institutions", "/api/v1/tags"} {
		if r := h.Call(anonymous, http.MethodGet, p, nil); r.Status != http.StatusUnauthorized {
			t.Errorf("GET %s without session = %d, want 401", p, r.Status)
		}
	}
}

func TestCloseAccountWithBalanceIs409(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-01", apitest.Posting(checking, -100), apitest.Posting(food, 100))
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/accounts/"+checking+"/close", map[string]string{"closed_on": "2026-10-31"}),
		http.StatusConflict, "account_not_empty", "")
}
