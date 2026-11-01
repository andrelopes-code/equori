package ledger_test

import (
	"errors"
	"net/http"
	"slices"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/ledger"
)

// A169: the entry's posting becomes one posting per line, each linked to its record.
func TestConfirmGroup(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-31"))
	ctx, uid := t.Context(), h.OwnerID()
	card := h.Card("Nubank card", 3, 10, "next")
	food := h.Account("Food", "expense", "", nil)

	entry := h.Record("2026-10-30", apitest.Posting(card, -11840), apitest.Posting(food, 11840))
	created := h.Record("2026-10-30", apitest.Posting(card, -11440), apitest.Posting(food, 11440))
	a, b := uuid.MustParse("00000000-0000-0000-0000-00000000000a"), uuid.MustParse("00000000-0000-0000-0000-00000000000b")
	parts := []ledger.GroupPart{
		{RecordID: b, Amount: -400, Date: day("2026-10-31"), Pending: true},
		{RecordID: a, Amount: -11440, Date: day("2026-10-30"), Pending: true, CreatedTx: uuid.MustParse(created)},
	}

	if err := h.App.Ledger.ConfirmGroup(ctx, uid, uuid.MustParse(entry), uuid.MustParse(card), parts); err != nil {
		t.Fatal(err)
	}

	rows := h.Rows(`SELECT amount, status, external_record_id::text FROM ledger_posting
		WHERE transaction_id = $1 AND account_id = $2 ORDER BY position`, entry, card)

	want := []string{"-11440 pending " + a.String(), "-400 pending " + b.String()}
	if !slices.Equal(rows, want) {
		t.Fatalf("card postings = %v, want %v", rows, want)
	}

	if got := h.Rows(`SELECT date::text || ' ' || version::text FROM ledger_transaction WHERE id = $1`, entry); got[0] != "2026-10-30 2" {
		t.Fatalf("entry = %v, want date 2026-10-30 and version 2", got)
	}

	if got := h.Rows(`SELECT (voided_at IS NOT NULL)::text FROM ledger_transaction WHERE id = $1`, created); got[0] != "true" {
		t.Fatalf("created transaction voided = %v, want true", got)
	}

	if err := h.App.Ledger.ConfirmGroup(ctx, uid, uuid.MustParse(entry), uuid.MustParse(card), parts); err != nil {
		t.Fatalf("repeating the same parts: %v", err)
	}

	if got := h.Rows(`SELECT version::text FROM ledger_transaction WHERE id = $1`, entry); got[0] != "2" {
		t.Fatalf("version after the repeat = %v, want 2", got)
	}
}

func TestConfirmGroupRefusals(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-31"))
	ctx, uid := t.Context(), h.OwnerID()
	card := h.Card("Nubank card", 3, 10, "next")
	food := h.Account("Food", "expense", "", nil)
	voided := h.Record("2026-10-30", apitest.Posting(card, -11840), apitest.Posting(food, 11840))
	h.MustDo(http.MethodPost, "/api/v1/transactions/"+voided+"/void", map[string]any{"reason": "test"}, http.StatusOK, nil)

	parts := []ledger.GroupPart{
		{RecordID: uuid.New(), Amount: -11440, Date: day("2026-10-30")},
		{RecordID: uuid.New(), Amount: -400, Date: day("2026-10-31")},
	}

	if err := h.App.Ledger.ConfirmGroup(ctx, uid, uuid.MustParse(voided), uuid.MustParse(card), parts); !errors.Is(err, ledger.ErrVoided) {
		t.Fatalf("voided entry: err = %v, want ErrVoided", err)
	}

	mismatch := h.Record("2026-10-30", apitest.Posting(card, -11840), apitest.Posting(food, 11840))
	parts[1].Amount = -390

	if err := h.App.Ledger.ConfirmGroup(ctx, uid, uuid.MustParse(mismatch), uuid.MustParse(card), parts); err == nil {
		t.Fatal("parts that do not sum to the entry: want an error")
	}
}

func TestGroupableTransactions(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-31"))
	ctx, uid := t.Context(), h.OwnerID()
	card := h.Card("Nubank card", 3, 10, "next")
	food := h.Account("Food", "expense", "", nil)
	manual := h.Record("2026-10-30", apitest.Posting(card, -11440), apitest.Posting(food, 11440))

	got, err := h.App.Ledger.GroupableTransactions(ctx, uid, []uuid.UUID{uuid.MustParse(manual), uuid.New()})
	if err != nil || len(got) != 0 {
		t.Fatalf("a manual and an unknown transaction: got %v, err %v, want none", got, err)
	}
}
