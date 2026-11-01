package ingestion_test

import (
	"fmt"
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
