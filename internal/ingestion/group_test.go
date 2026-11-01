package ingestion_test

import (
	"fmt"
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
)

// S234 (A167, A168): the entry of 118.40 and the institution's lines 114.40 and 4.00.
func TestS234LinesWaitInReviewAsAGroup(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	food := f.h.Account("Food", "expense", "", nil)
	entry := f.h.Record("2026-10-30", apitest.Posting(card, -11840), apitest.Posting(food, 11840))
	f.line(pluggy.SubtypeCard, cardLine("a", "2026-10-30", "114.40", "PENDING", nil))
	f.line(pluggy.SubtypeCard, cardLine("b", "2026-10-31", "4.00", "PENDING", nil))
	f.sync()

	inReview := f.count(`SELECT count(*) FROM ingestion_external_record
		WHERE external_id IN ('a', 'b') AND state = 'needs_review' AND review_reason = 'group' AND $1::uuid = ANY (candidates)`, entry)
	if inReview != 2 {
		t.Fatalf("records in review group = %d, want 2", inReview)
	}

	if postings := f.count(`SELECT count(*) FROM ledger_posting WHERE account_id = $1 AND NOT voided`, card); postings != 1 {
		t.Fatalf("card postings = %d, want 1 (the entry)", postings)
	}
}

// S237 (A168): two entries with the same group get none; the lines are created.
func TestS237TwoEntriesProposeNoGroup(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	food := f.h.Account("Food", "expense", "", nil)
	f.h.Record("2026-10-30", apitest.Posting(card, -11840), apitest.Posting(food, 11840))
	f.h.Record("2026-10-30", apitest.Posting(card, -11840), apitest.Posting(food, 11840))
	f.line(pluggy.SubtypeCard, cardLine("a", "2026-10-30", "114.40", "PENDING", nil))
	f.line(pluggy.SubtypeCard, cardLine("b", "2026-10-31", "4.00", "PENDING", nil))
	f.sync()

	if created := f.count(`SELECT count(*) FROM ingestion_external_record WHERE external_id IN ('a', 'b') AND state = 'created'`); created != 2 {
		t.Fatalf("created records = %d, want 2", created)
	}

	if review := f.count(`SELECT count(*) FROM ingestion_external_record WHERE review_reason = 'group'`); review != 0 {
		t.Fatalf("records in review group = %d, want 0", review)
	}
}

// S239 (A168): more than 40 eligible lines are not searched.
func TestS239ABoundOf40Lines(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	food := f.h.Account("Food", "expense", "", nil)
	f.h.Record("2026-10-30", apitest.Posting(card, -11840), apitest.Posting(food, 11840))
	f.line(pluggy.SubtypeCard, cardLine("a", "2026-10-30", "114.40", "PENDING", nil))
	f.line(pluggy.SubtypeCard, cardLine("b", "2026-10-31", "4.00", "PENDING", nil))

	for i := range 39 {
		f.line(pluggy.SubtypeCard, cardLine(fmt.Sprintf("f-%02d", i), "2026-10-30", "1.00", "PENDING", nil))
	}

	f.sync()

	if review := f.count(`SELECT count(*) FROM ingestion_external_record WHERE review_reason = 'group'`); review != 0 {
		t.Fatalf("records in review group = %d, want 0 with 41 eligible lines", review)
	}
}

// S234 (A169): match confirms the entry by both lines.
func TestS234MatchConfirmsTheGroup(t *testing.T) {
	t.Parallel()
	f, card, entry := groupFixture(t)

	f.resolve("a", map[string]any{"action": "match", "transaction_id": entry})

	rows := f.h.Rows(`SELECT amount, status FROM ledger_posting
		WHERE transaction_id = $1 AND account_id = $2 AND NOT voided ORDER BY position`, entry, card)
	if want := []string{"-11440 pending", "-400 pending"}; !slices.Equal(rows, want) {
		t.Fatalf("card postings = %v, want %v", rows, want)
	}

	if matched := f.count(`SELECT count(*) FROM ingestion_external_record WHERE external_id IN ('a', 'b') AND state = 'matched' AND transaction_id = $1`, entry); matched != 2 {
		t.Fatalf("matched records = %d, want 2", matched)
	}

	if cat := f.count(`SELECT count(*) FROM ledger_posting WHERE transaction_id = $1 AND amount = 11840`, entry); cat != 1 {
		t.Fatalf("category postings of 118.40 = %d, want 1", cat)
	}
}

// S236 (A167 condition 6): the first line was created in an earlier sync.
func TestS236TheFirstLineWasCreatedBefore(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	food := f.h.Account("Food", "expense", "", nil)
	entry := f.h.Record("2026-10-30", apitest.Posting(card, -11840), apitest.Posting(food, 11840))
	f.line(pluggy.SubtypeCard, cardLine("a", "2026-10-30", "114.40", "PENDING", nil))
	f.sync()

	_, created := f.recordOf("a")
	f.line(pluggy.SubtypeCard, cardLine("b", "2026-10-31", "4.00", "PENDING", nil))
	f.sync()

	if state, _ := f.recordOf("b"); state != "needs_review" {
		t.Fatalf("b state = %s, want needs_review", state)
	}

	f.resolve("b", map[string]any{"action": "match", "transaction_id": entry})

	if postings := f.count(`SELECT count(*) FROM ledger_posting WHERE account_id = $1 AND NOT voided`, card); postings != 2 {
		t.Fatalf("card postings = %d, want 2", postings)
	}

	if voided := f.count(`SELECT count(*) FROM ledger_transaction WHERE id = $1 AND voided_at IS NOT NULL`, created); voided != 1 {
		t.Fatalf("created transaction voided = %d, want 1", voided)
	}

	if state, tx := f.recordOf("a"); state != "created" || tx != entry {
		t.Fatalf("a = %s on %s, want created on %s", state, tx, entry)
	}
}

// S238 (A169): discard and create dissolve the group.
func TestS238DiscardAndCreateDissolveTheGroup(t *testing.T) {
	t.Parallel()
	f, _, entry := groupFixture(t)

	f.resolve("b", map[string]any{"action": "discard"})

	if state, _ := f.recordOf("b"); state != "discarded" {
		t.Fatalf("b state = %s, want discarded", state)
	}

	if state, tx := f.recordOf("a"); state != "created" || tx == entry {
		t.Fatalf("a = %s on %s, want created on its own transaction", state, tx)
	}

	g, _, _ := groupFixture(t)
	g.resolve("a", map[string]any{"action": "create"})

	for _, id := range []string{"a", "b"} {
		if state, _ := g.recordOf(id); state != "created" {
			t.Fatalf("%s state = %s, want created", id, state)
		}
	}
}

// A169, group_changed: the entry no longer sums to the lines.
func TestGroupChangedWhenTheEntryIsCorrected(t *testing.T) {
	t.Parallel()
	f, card, entry := groupFixture(t)
	food := f.h.Account("Other", "expense", "", nil)
	f.h.MustDo(http.MethodPut, "/api/v1/transactions/"+entry, map[string]any{
		"date": "2026-10-30", "description": "test", "expected_version": 1, "reason": "test",
		"postings": []any{apitest.Posting(card, -11000), apitest.Posting(food, 11000)},
	}, http.StatusOK, nil)

	var problem struct {
		Code string `json:"code"`
	}

	f.resolveStatus("a", map[string]any{"action": "match", "transaction_id": entry}, http.StatusConflict, &problem)

	if problem.Code != "group_changed" {
		t.Fatalf("problem code = %q, want group_changed", problem.Code)
	}
}

// groupFixture is S234 before the review: the entry and the lines a and b in review group.
func groupFixture(t *testing.T) (syncFixture, string, string) {
	t.Helper()
	f, card := newCardSync(t)
	food := f.h.Account("Food", "expense", "", nil)
	entry := f.h.Record("2026-10-30", apitest.Posting(card, -11840), apitest.Posting(food, 11840))
	f.line(pluggy.SubtypeCard, cardLine("a", "2026-10-30", "114.40", "PENDING", nil))
	f.line(pluggy.SubtypeCard, cardLine("b", "2026-10-31", "4.00", "PENDING", nil))
	f.sync()

	return f, card, entry
}

// resolve posts a resolution of the record with the external id and expects 200.
func (f syncFixture) resolve(externalID string, body map[string]any) {
	f.resolveStatus(externalID, body, http.StatusOK, nil)
}

func (f syncFixture) resolveStatus(externalID string, body map[string]any, status int, out any) {
	f.h.T().Helper()

	var record string
	if err := f.h.Pool.QueryRow(f.h.T().Context(), `SELECT id::text FROM ingestion_external_record WHERE external_id = $1`, externalID).Scan(&record); err != nil {
		f.h.T().Fatalf("record %s: %v", externalID, err)
	}

	f.h.MustDo(http.MethodPost, "/api/v1/external-records/"+record+"/resolve", body, status, out)
}

// S235 (A170): without an exact sum the lines are created and the entry stays awaiting.
func TestS235SumNotExactLeavesTheEntryAwaiting(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	food := f.h.Account("Food", "expense", "", nil)
	f.h.Record("2026-10-30", apitest.Posting(card, -11840), apitest.Posting(food, 11840))
	f.line(pluggy.SubtypeCard, cardLine("a", "2026-10-30", "114.40", "PENDING", nil))
	f.line(pluggy.SubtypeCard, cardLine("b", "2026-10-31", "3.90", "PENDING", nil))
	f.sync()

	if review := f.count(`SELECT count(*) FROM ingestion_external_record WHERE review_reason = 'group'`); review != 0 {
		t.Fatalf("records in review group = %d, want 0", review)
	}

	var list struct {
		Items []struct {
			AmountDue       moneyView  `json:"amount_due"`
			ConfirmedAmount *moneyView `json:"confirmed_amount"`
			AwaitingAmount  *moneyView `json:"awaiting_amount"`
		} `json:"items"`
	}

	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+card+"/statements?from=2026-11&to=2026-11", nil, http.StatusOK, &list)

	if len(list.Items) != 1 || list.Items[0].ConfirmedAmount == nil || list.Items[0].AwaitingAmount == nil {
		t.Fatalf("statements = %+v, want one with both parts", list.Items)
	}

	got := list.Items[0]
	if got.AmountDue.Amount != 23670 || got.ConfirmedAmount.Amount != 11830 || got.AwaitingAmount.Amount != 11840 {
		t.Fatalf("amount due %d, confirmed %d, awaiting %d, want 23670, 11830, 11840",
			got.AmountDue.Amount, got.ConfirmedAmount.Amount, got.AwaitingAmount.Amount)
	}
}

type moneyView struct {
	Amount int64 `json:"amount"`
}

// A168: a record in review group lists the other lines of its group and keeps its entry.
func TestGroupRecordsListTheirGroup(t *testing.T) {
	t.Parallel()
	f, _, entry := groupFixture(t)

	var batch string
	if err := f.h.Pool.QueryRow(t.Context(),
		`SELECT batch_id::text FROM ingestion_external_record WHERE external_id = 'a'`).Scan(&batch); err != nil {
		t.Fatal(err)
	}

	var list struct {
		Items []struct {
			ExternalID     string   `json:"external_id"`
			ID             string   `json:"id"`
			Candidates     []string `json:"candidates"`
			GroupRecordIDs []string `json:"group_record_ids"`
		} `json:"items"`
	}

	f.h.MustDo(http.MethodGet, "/api/v1/import-batches/"+batch+"/records?state=needs_review", nil, http.StatusOK, &list)

	ids := map[string]string{}
	for _, it := range list.Items {
		ids[it.ExternalID] = it.ID
	}

	if len(list.Items) != 2 {
		t.Fatalf("records in review = %d, want 2", len(list.Items))
	}

	for _, it := range list.Items {
		other := ids["a"]
		if it.ExternalID == "a" {
			other = ids["b"]
		}

		if !slices.Equal(it.GroupRecordIDs, []string{other}) || !slices.Equal(it.Candidates, []string{entry}) {
			t.Fatalf("record %s: group %v candidates %v, want [%s] and [%s]",
				it.ExternalID, it.GroupRecordIDs, it.Candidates, other, entry)
		}
	}
}
