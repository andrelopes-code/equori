package ledger_test

import (
	"errors"
	"fmt"
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func imported(t *testing.T, account, date string, amount int64) ledger.ImportedPosting {
	t.Helper()
	d, err := time.Parse(time.DateOnly, date)
	if err != nil {
		t.Fatal(err)
	}
	m, err := money.New(amount, "BRL")
	if err != nil {
		t.Fatal(err)
	}
	return ledger.ImportedPosting{AccountID: uuid.MustParse(account), Date: d, Amount: m, Description: "Statement line"}
}

func systemAccounts(h *apitest.Harness) map[string]string {
	var out struct {
		Items []struct {
			ID         string `json:"id"`
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &out)
	m := map[string]string{}
	for _, a := range out.Items {
		if a.SystemRole != "" {
			m[a.SystemRole] = a.ID
		}
	}
	return m
}

// P4 amendments A11 and A14.
func TestRecordImported(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	h, uid := c.h, c.h.OwnerID()
	sys := systemAccounts(h)
	ctx := t.Context()

	record := uuid.New()
	first, err := h.App.Ledger.RecordImported(ctx, uid, record, imported(t, c.checking, "2026-10-05", -12000))
	if err != nil {
		t.Fatal(err)
	}
	again, err := h.App.Ledger.RecordImported(ctx, uid, record, imported(t, c.checking, "2026-10-05", -12000))
	if err != nil || again != first {
		t.Fatalf("second call = %s, %v; want %s", again, err, first)
	}
	tx := h.Transaction(first.String())
	if got := amountsByAccount(tx); tx.Origin != "import" || got[c.checking] != -12000 || got[sys["uncategorized_expense"]] != 12000 {
		t.Fatalf("expense = %+v", tx)
	}

	income, err := h.App.Ledger.RecordImported(ctx, uid, uuid.New(), imported(t, c.checking, "2026-10-06", 300000))
	if err != nil {
		t.Fatal(err)
	}
	if got := amountsByAccount(h.Transaction(income.String())); got[sys["uncategorized_income"]] != -300000 {
		t.Fatalf("income postings = %v", got)
	}

	for _, tc := range []struct {
		amount int64
		role   string
	}{{-23000, "charge"}, {23000, "credit"}} {
		id, err := h.App.Ledger.RecordImported(ctx, uid, uuid.New(), imported(t, c.card, "2026-10-14", tc.amount))
		if err != nil {
			t.Fatal(err)
		}
		for _, p := range h.Transaction(id.String()).Postings {
			if p.AccountID == c.card && (p.CardRole != tc.role || p.Statement != "2026-11") {
				t.Fatalf("card posting = %+v, want %s on 2026-11", p, tc.role)
			}
		}
	}
}

func TestUnlinkedPostingsAndClearMatched(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	h, uid := c.h, c.h.OwnerID()
	ctx := t.Context()
	var pending idOnly
	h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{"date": "2026-10-04", "postings": []map[string]any{
		{"account_id": c.checking, "amount": apitest.BRL(-4590), "status": "pending"}, apitest.Posting(c.food, 4590),
	}}, http.StatusCreated, &pending)
	h.Record("2026-10-09", apitest.Posting(c.checking, -4590), apitest.Posting(c.food, 4590))
	voided := h.Record("2026-10-05", apitest.Posting(c.checking, -4590), apitest.Posting(c.food, 4590))
	h.MustDo(http.MethodPost, "/api/v1/transactions/"+voided+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)
	other := h.Record("2026-10-05", apitest.Posting(c.checking, -4500), apitest.Posting(c.food, 4500))
	h.Record("2026-10-05", apitest.Posting(c.card, -4590), apitest.Posting(c.food, 4590))

	line := imported(t, c.checking, "2026-10-05", -4590)
	unlinked := func() []string {
		ps, err := h.App.Ledger.UnlinkedPostings(ctx, uid, line.AccountID, line.Date.AddDate(0, 0, -3), line.Date.AddDate(0, 0, 3))
		if err != nil {
			t.Fatal(err)
		}
		var out []string
		for _, p := range ps {
			out = append(out, fmt.Sprintf("%s %s %d", p.TransactionID, p.Date.Format(time.DateOnly), p.Amount))
		}
		return out
	}
	want := []string{pending.ID + " 2026-10-04 -4590", other + " 2026-10-05 -4500"}
	if got := unlinked(); !slices.Equal(got, want) {
		t.Fatalf("unlinked = %v, want %v (voided, out of window and other accounts excluded)", got, want)
	}

	record := uuid.New()
	txID := uuid.MustParse(pending.ID)
	if err := h.App.Ledger.ClearMatched(ctx, uid, record, txID, line.AccountID); err != nil {
		t.Fatal(err)
	}
	if err := h.App.Ledger.ClearMatched(ctx, uid, record, txID, line.AccountID); err != nil {
		t.Fatalf("repeated match: %v", err)
	}
	for _, p := range h.Transaction(pending.ID).Postings {
		if p.AccountID == c.checking && p.Status != "cleared" {
			t.Fatalf("matched posting status = %q", p.Status)
		}
	}
	if err := h.App.Ledger.ClearMatched(ctx, uid, uuid.New(), txID, line.AccountID); !errors.Is(err, ledger.ErrAlreadyMatched) {
		t.Fatalf("second record: err = %v, want ErrAlreadyMatched", err)
	}
	if got := unlinked(); !slices.Equal(got, want[1:]) {
		t.Fatalf("after the match, unlinked = %v", got)
	}
}

// P5b amendment A27: record links live on postings and survive corrections.
func TestRecordLinksFollowPostings(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	h, uid := c.h, c.h.OwnerID()
	ctx := t.Context()
	savings := h.Account("Savings", "asset", "savings", nil)
	linkedAccount := func(record uuid.UUID) string {
		t.Helper()
		var account string
		if err := h.Pool.QueryRow(ctx, `SELECT account_id FROM ledger_posting WHERE external_record_id = $1`, record).Scan(&account); err != nil {
			t.Fatal(err)
		}
		return account
	}

	record := uuid.New()
	id, err := h.App.Ledger.RecordImported(ctx, uid, record, imported(t, c.checking, "2026-10-05", -12000))
	if err != nil {
		t.Fatal(err)
	}
	correct := func(version int, postings ...map[string]any) apitest.Response {
		return h.Do(http.MethodPut, "/api/v1/transactions/"+id.String(), map[string]any{
			"date": "2026-10-05", "description": "Statement line", "expected_version": version, "reason": "edit", "postings": postings,
		})
	}
	if r := correct(1, apitest.Posting(c.food, 12000), apitest.Posting(c.checking, -12000)); r.Status != http.StatusOK {
		t.Fatalf("correction status %d: %s", r.Status, r.Body)
	}
	if got := linkedAccount(record); got != c.checking {
		t.Fatalf("record on %s after correction, want checking", got)
	}
	h.ExpectProblem(correct(2, apitest.Posting(c.food, 12000), apitest.Posting(savings, -12000)), http.StatusUnprocessableEntity, "validation_failed", "postings")
	if got := linkedAccount(record); got != c.checking {
		t.Fatalf("record on %s after a rejected correction", got)
	}

	transfer := h.Record("2026-10-06", apitest.Posting(c.checking, -5000), apitest.Posting(savings, 5000))
	txID := uuid.MustParse(transfer)
	first, second := uuid.New(), uuid.New()
	if err := h.App.Ledger.ClearMatched(ctx, uid, first, txID, uuid.MustParse(c.checking)); err != nil {
		t.Fatal(err)
	}
	if err := h.App.Ledger.ClearMatched(ctx, uid, second, txID, uuid.MustParse(savings)); err != nil {
		t.Fatalf("second side of a transfer: %v", err)
	}
	if linkedAccount(first) != c.checking || linkedAccount(second) != savings {
		t.Fatal("transfer sides not linked to their accounts")
	}
	if _, err := h.Pool.Exec(ctx, `UPDATE ledger_posting SET external_record_id = $1 WHERE transaction_id = $2 AND account_id = $3`, record, txID, savings); err == nil {
		t.Fatal("database accepted one record on two postings")
	}
}
