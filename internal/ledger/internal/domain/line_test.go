package domain

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

// A101, Review Focus 4: the posting on the account takes the line's amount and date; the
// other postings scale to it and the last one takes the remainder.
func TestToLine(t *testing.T) {
	t.Parallel()
	checking, food, drinks := uuid.New(), uuid.New(), uuid.New()
	tx := Transaction{Date: day("2026-10-20"), Description: "Lunch", Postings: []Posting{
		{AccountID: checking, Amount: brl(t, -700)}, {AccountID: food, Amount: brl(t, 300)}, {AccountID: drinks, Amount: brl(t, 400)},
	}}
	next, changed, err := tx.ToLine(checking, -712, day("2026-10-21"))
	if err != nil || !changed {
		t.Fatalf("ToLine = %v, %v", changed, err)
	}
	got := []int64{next.Postings[0].Amount.Amount(), next.Postings[1].Amount.Amount(), next.Postings[2].Amount.Amount()}
	if got[0] != -712 || got[1] != 305 || got[2] != 407 || !next.Date.Equal(day("2026-10-21")) || next.Description != "Lunch" {
		t.Fatalf("next = %v on %s", got, next.Date.Format(time.DateOnly))
	}
	if _, changed, err := tx.ToLine(checking, -700, day("2026-10-20")); changed || err != nil {
		t.Fatalf("same amount and date: changed %v, err %v", changed, err)
	}
	if _, _, err := tx.ToLine(uuid.New(), -712, day("2026-10-20")); err == nil {
		t.Fatal("an account without a posting: want an error")
	}
}
