package ledger_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestTransactionFacts(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-10-25"))
	ctx, uid := t.Context(), h.OwnerID()
	sys := systemAccounts(h)
	card := h.Card("Itaú Visa", 3, 10, "next")
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	electronics := h.Account("Electronics", "expense", "", nil)
	purchase := installmentPurchase(t, h, map[string]any{
		"card_account_id": card, "date": "2026-10-20", "description": "Laptop",
		"splits": []map[string]any{{"account_id": electronics, "amount": apitest.BRL(100000)}}, "installment_count": 3,
	})
	edited := h.Record("2026-10-21", apitest.Posting(checking, -1000), apitest.Posting(sys["uncategorized_expense"], 1000))
	h.MustDo(http.MethodPut, "/api/v1/transactions/"+edited, map[string]any{
		"date": "2026-10-21", "description": "Bakery", "expected_version": 1, "reason": "rename",
		"postings": []any{apitest.Posting(checking, -1000), apitest.Posting(sys["uncategorized_expense"], 1000)},
	}, http.StatusOK, nil)

	ids := []uuid.UUID{uuid.MustParse(edited), uuid.New(), uuid.MustParse(purchase.Transaction.ID)}
	facts, err := h.App.Ledger.TransactionFacts(ctx, uid, ids)
	if err != nil {
		t.Fatal(err)
	}
	if len(facts) != 2 || facts[0].ID != ids[0] || facts[1].ID != ids[2] {
		t.Fatalf("facts = %+v", facts)
	}
	e := facts[0]
	if e.Version != 2 || e.Description != "Bakery" || e.RawDescription != "test" || e.Origin != "manual" || e.Voided ||
		e.CategoryState != "uncategorized" || e.Date.Format("2006-01-02") != "2026-10-21" || len(e.Postings) != 2 {
		t.Fatalf("edited = %+v", e)
	}
	p := facts[1]
	if p.CategoryState != "categorized" || p.RawDescription != "Laptop" {
		t.Fatalf("purchase = %+v", p)
	}
	var cardPosting, category *ledger.FactPosting
	for i := range p.Postings {
		switch p.Postings[i].AccountID.String() {
		case card:
			cardPosting = &p.Postings[i]
		case electronics:
			category = &p.Postings[i]
		}
	}
	if cardPosting == nil || cardPosting.Class != "liability" || cardPosting.Kind != "credit_card" || !cardPosting.Installment {
		t.Fatalf("card posting = %+v", cardPosting)
	}
	if category == nil || category.Class != "expense" || category.Kind != "" || category.Installment || category.Amount.Amount() <= 0 {
		t.Fatalf("category posting = %+v", category)
	}

	h.MustDo(http.MethodPost, "/api/v1/transactions/"+edited+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)
	if facts, err = h.App.Ledger.TransactionFacts(ctx, uid, ids[:1]); err != nil || !facts[0].Voided {
		t.Fatalf("voided facts = %+v, %v", facts, err)
	}
}

func TestAccountFactsAndPayees(t *testing.T) {
	h := apitest.New(t)
	ctx, uid := t.Context(), h.OwnerID()
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	facts, err := h.App.Ledger.AccountFacts(ctx, uid)
	if err != nil {
		t.Fatal(err)
	}
	roles := 0
	var found *ledger.AccountFact
	for i, a := range facts {
		if a.SystemRole != "" {
			roles++
		}
		if a.ID.String() == checking {
			found = &facts[i]
		}
	}
	if roles != 12 || found == nil || found.Class != "asset" || found.Kind != "checking" || found.Instrument != "BRL" || found.ClosedOn != nil {
		t.Fatalf("facts = %+v (system roles %d)", found, roles)
	}

	var payee struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": "iFood"}, http.StatusCreated, &payee)
	unknown := uuid.New()
	missing, err := h.App.Ledger.MissingPayees(ctx, uid, []uuid.UUID{uuid.MustParse(payee.ID), unknown})
	if err != nil || !slices.Equal(missing, []uuid.UUID{unknown}) {
		t.Fatalf("missing = %v, %v", missing, err)
	}
}

// P5 amendment A23.
func TestLatestPayeeCategories(t *testing.T) {
	h := apitest.New(t)
	ctx, uid := t.Context(), h.OwnerID()
	sys := systemAccounts(h)
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	delivery := h.Account("Delivery", "expense", "", nil)
	restaurant := h.Account("Restaurant", "expense", "", nil)
	refunds := h.Account("Refunds", "income", "", nil)
	var payee struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": "iFood"}, http.StatusCreated, &payee)
	record := func(date string, postings ...map[string]any) string {
		var out struct {
			ID string `json:"id"`
		}
		h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{"date": date, "description": "iFood", "payee_id": payee.ID, "postings": postings}, http.StatusCreated, &out)
		return out.ID
	}
	record("2026-10-01", apitest.Posting(checking, -1000), apitest.Posting(delivery, 1000))
	record("2026-10-02", apitest.Posting(checking, 500), apitest.Posting(refunds, -500))
	record("2026-10-03", apitest.Posting(checking, -1000), apitest.Posting(restaurant, 600), apitest.Posting(delivery, 400))
	record("2026-10-04", apitest.Posting(checking, -1000), apitest.Posting(sys["uncategorized_expense"], 1000))
	voided := record("2026-10-05", apitest.Posting(checking, -1000), apitest.Posting(restaurant, 1000))
	h.MustDo(http.MethodPost, "/api/v1/transactions/"+voided+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)

	pid := uuid.MustParse(payee.ID)
	got, err := h.App.Ledger.LatestPayeeCategories(ctx, uid, []uuid.UUID{pid, uuid.New()})
	if err != nil {
		t.Fatal(err)
	}
	want := map[ledger.PayeeClass]uuid.UUID{
		{PayeeID: pid, Class: "expense"}: uuid.MustParse(delivery),
		{PayeeID: pid, Class: "income"}:  uuid.MustParse(refunds),
	}
	if len(got) != len(want) || got[ledger.PayeeClass{PayeeID: pid, Class: "expense"}] != want[ledger.PayeeClass{PayeeID: pid, Class: "expense"}] ||
		got[ledger.PayeeClass{PayeeID: pid, Class: "income"}] != want[ledger.PayeeClass{PayeeID: pid, Class: "income"}] {
		t.Fatalf("latest = %v, want %v", got, want)
	}
}

// P5 amendment A19: an import decision creates the category postings at version 1.
func TestRecordImportedWithDecision(t *testing.T) {
	h := apitest.New(t)
	ctx, uid := t.Context(), h.OwnerID()
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	transport := h.Account("Transport", "expense", "", nil)
	var payee struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": "Uber"}, http.StatusCreated, &payee)
	rule := uuid.New()
	pid := uuid.MustParse(payee.ID)
	amount, err := money.New(2390, "BRL")
	if err != nil {
		t.Fatal(err)
	}
	ids, err := h.App.Ledger.RecordImportedBatch(ctx, uid, []ledger.ImportedRecord{{
		RecordID: uuid.New(), Posting: imported(t, checking, "2026-10-05", -2390),
		Decision: &ledger.ImportDecision{
			PayeeID: pid, AddTags: []string{"ride"}, Parts: []ledger.CategoryPart{{AccountID: uuid.MustParse(transport), Amount: amount}},
			Cause: ledger.Cause{Method: "rule", RuleID: rule},
		},
	}})
	if err != nil {
		t.Fatal(err)
	}
	tx := h.Transaction(ids[0].String())
	if got := amountsByAccount(tx); tx.Version != 1 || len(tx.Postings) != 2 || got[transport] != 2390 || got[checking] != -2390 {
		t.Fatalf("transaction = %+v", tx)
	}
	var full struct {
		PayeeID string   `json:"payee_id"`
		Tags    []string `json:"tags"`
	}
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+ids[0].String(), nil, http.StatusOK, &full)
	if full.PayeeID != payee.ID || !slices.Equal(full.Tags, []string{"ride"}) {
		t.Fatalf("payee and tags = %+v", full)
	}
	recorded := events(t, h, ids[0].String())["ledger.transaction_recorded.v1"]
	if len(recorded) != 1 || recorded[0].Origin != "import" || recorded[0].CategoryState != "categorized" ||
		recorded[0].Cause == nil || recorded[0].Cause.Method != "rule" || recorded[0].Cause.RuleID != rule.String() {
		t.Fatalf("recorded = %+v", recorded)
	}
}

func TestListUncategorizedTransactions(t *testing.T) {
	h := apitest.New(t)
	sys := systemAccounts(h)
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	savings := h.Account("Savings", "asset", "savings", nil)
	food := h.Account("Food", "expense", "", nil)
	want := h.Record("2026-10-01", apitest.Posting(checking, -1000), apitest.Posting(sys["uncategorized_expense"], 1000))
	h.Record("2026-10-02", apitest.Posting(checking, -1000), apitest.Posting(savings, 1000))
	h.Record("2026-10-03", apitest.Posting(checking, -1000), apitest.Posting(food, 1000))
	h.Record("2026-10-04", apitest.Posting(checking, -1000), apitest.Posting(food, 600), apitest.Posting(sys["uncategorized_expense"], 400))

	var out struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/transactions?uncategorized=true", nil, http.StatusOK, &out)
	if len(out.Items) != 1 || out.Items[0].ID != want {
		t.Fatalf("items = %+v, want %s", out.Items, want)
	}
	h.MustDo(http.MethodGet, "/api/v1/transactions?uncategorized=false", nil, http.StatusOK, &out)
	if len(out.Items) != 4 {
		t.Fatalf("all items = %d, want 4", len(out.Items))
	}
}
