package domain

import (
	"testing"

	"github.com/google/uuid"
)

func TestActualAmount(t *testing.T) {
	t.Parallel()

	account, other := uuid.New(), uuid.New()

	tests := []struct {
		name     string
		kind     Kind
		postings []Posting
		want     int64
		wantOK   bool
	}{
		{"income", Income, []Posting{{account, 275142}, {other, -275142}}, 275142, true},
		{"expense", Bill, []Posting{{account, -12000}, {other, 12000}}, 12000, true},
		{"split on the account", Income, []Posting{{account, 100000}, {account, 175142}, {other, -275142}}, 275142, true},
		{"no posting on the account", Income, []Posting{{other, 100}}, 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, ok := ActualAmount(Transaction{Postings: tt.postings}, Schedule{Kind: tt.kind, AccountID: account})
			if got != tt.want || ok != tt.wantOK {
				t.Fatalf("ActualAmount = %d, %t; want %d, %t", got, ok, tt.want, tt.wantOK)
			}
		})
	}
}
