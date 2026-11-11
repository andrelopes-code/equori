package domain

import (
	"slices"
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

// A169: the posting on the account becomes one posting per line; the others keep theirs.
func TestSplitToLines(t *testing.T) {
	t.Parallel()

	card, food := uuid.New(), uuid.New()
	tx := Transaction{Date: day("2026-10-30"), Description: "Assinatura", Postings: []Posting{
		{AccountID: card, Amount: brl(t, -11840)}, {AccountID: food, Amount: brl(t, 11840)},
	}}

	tests := []struct {
		name    string
		account uuid.UUID
		parts   []LinePart
		date    string
		want    []int64
		status  []PostingStatus
		wantErr bool
	}{
		{
			name: "S234 a purchase and its fee", account: card, date: "2026-10-30",
			parts:  []LinePart{{Amount: -11440, Pending: true}, {Amount: -400, Pending: true}},
			want:   []int64{-11440, -400, 11840},
			status: []PostingStatus{StatusPending, StatusPending, ""},
		},
		{
			name: "a settled line and a pending line", account: card, date: "2026-10-29",
			parts:  []LinePart{{Amount: -11440}, {Amount: -400, Pending: true}},
			want:   []int64{-11440, -400, 11840},
			status: []PostingStatus{StatusCleared, StatusPending, ""},
		},
		{
			name: "a sum that differs", account: card, date: "2026-10-30",
			parts: []LinePart{{Amount: -11440}, {Amount: -390}}, wantErr: true,
		},
		{
			name: "one line", account: card, date: "2026-10-30",
			parts: []LinePart{{Amount: -11840}}, wantErr: true,
		},
		{
			name: "a line of the other sign", account: card, date: "2026-10-30",
			parts: []LinePart{{Amount: -12240}, {Amount: 400}}, wantErr: true,
		},
		{
			name: "a line of zero", account: card, date: "2026-10-30",
			parts: []LinePart{{Amount: -11840}, {Amount: 0}}, wantErr: true,
		},
		{
			name: "an account without a posting", account: uuid.New(), date: "2026-10-30",
			parts: []LinePart{{Amount: -11440}, {Amount: -400}}, wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			next, err := tx.SplitToLines(tt.account, day(tt.date), tt.parts)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, want error %t", err, tt.wantErr)
			}

			if tt.wantErr {
				return
			}

			got := make([]int64, len(next.Postings))
			status := make([]PostingStatus, len(next.Postings))

			for i, p := range next.Postings {
				got[i], status[i] = p.Amount.Amount(), p.Status
			}

			sameDate := next.Date.Equal(day(tt.date))
			if !slices.Equal(got, tt.want) || !slices.Equal(status, tt.status) || !sameDate {
				t.Fatalf("postings = %v %v on %s, want %v %v on %s",
					got, status, next.Date.Format(time.DateOnly), tt.want, tt.status, tt.date)
			}

			if len(tx.Postings) != 2 || tx.Postings[0].Amount.Amount() != -11840 {
				t.Fatal("the transaction was changed")
			}
		})
	}
}
