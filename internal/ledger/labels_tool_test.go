package ledger_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestListPayeesAndTagsTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-23"))
	for _, n := range []string{"Uber", "Padaria"} {
		h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": n}, http.StatusCreated, nil)
	}
	checking := h.Account("Checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-20", "description": "x", "tags": []string{"trip"},
		"postings": []map[string]any{apitest.Posting(checking, -100), apitest.Posting(food, 100)},
	}, http.StatusCreated, nil)

	var payees struct {
		Payees []struct {
			Name string `json:"name"`
		} `json:"payees"`
	}
	toolOutput(t, h, "list_payees_and_tags", map[string]any{"kind": "payees", "query": "ub"}, &payees)
	if len(payees.Payees) != 1 || payees.Payees[0].Name != "Uber" {
		t.Errorf("payees = %+v", payees)
	}
	var tags struct {
		Tags []string `json:"tags"`
	}
	toolOutput(t, h, "list_payees_and_tags", map[string]any{"kind": "tags"}, &tags)
	if !slices.Equal(tags.Tags, []string{"trip"}) {
		t.Errorf("tags = %v", tags.Tags)
	}
	h.ExpectToolError(h.Tool("list_payees_and_tags", map[string]any{"kind": "other"}), "invalid_arguments", "")
}

func TestListAccountsInstitution(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-23"))
	var inst struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]string{"name": "Itaú"}, http.StatusCreated, &inst)
	h.Account("Checking", "asset", "checking", map[string]any{"institution_id": inst.ID})
	var out struct {
		BaseCurrency string `json:"base_currency"`
		Accounts     []struct {
			Name            string `json:"name"`
			InstitutionName string `json:"institution_name"`
		} `json:"accounts"`
	}
	toolOutput(t, h, "list_accounts", map[string]any{"class": "asset"}, &out)
	if out.BaseCurrency != "BRL" || len(out.Accounts) != 1 || out.Accounts[0].InstitutionName != "Itaú" {
		t.Errorf("list_accounts = %+v", out)
	}
}
