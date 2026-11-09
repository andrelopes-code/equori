package domain

import (
	"errors"
	"testing"

	"github.com/google/uuid"
)

// S356: Unpair returns a paired transaction to the category side of its previous version.
func TestUnpair(t *testing.T) {
	t.Parallel()
	f := newCategorizeFixture(t)
	link := uuid.Must(uuid.NewV7())

	before := f.record(t,
		Posting{AccountID: f.checking.ID, Amount: brl(t, -25000)},
		Posting{AccountID: f.uncategorized.ID, Amount: brl(t, 25000)},
	)
	paired := func(t *testing.T, status PostingStatus) Transaction {
		p := f.record(t,
			Posting{AccountID: f.checking.ID, Amount: brl(t, -25000)},
			Posting{AccountID: f.savings.ID, Amount: brl(t, 25000), Status: status, ExternalRecordID: link},
		)
		p.Version = 2

		return p
	}
	credit := before
	credit.Postings = []Posting{
		{AccountID: f.checking.ID, Amount: brl(t, -25000)},
		{AccountID: f.card.ID, Amount: brl(t, 25000), CardRole: RoleCredit},
	}

	tests := []struct {
		name    string
		tx      Transaction
		version int
		link    uuid.UUID
		before  Transaction
		want    []Posting
		wantErr error
	}{
		{
			name: "returns the category side", tx: paired(t, StatusCleared), version: 2, link: link, before: before,
			want: []Posting{
				{AccountID: f.checking.ID, Amount: brl(t, -25000)},
				{AccountID: f.uncategorized.ID, Amount: brl(t, 25000)},
			},
		},
		{name: "stale version", tx: paired(t, StatusCleared), version: 1, link: link, before: before, wantErr: ErrVersionConflict},
		{name: "reconciled", tx: paired(t, StatusReconciled), version: 2, link: link, before: before, wantErr: ErrReconciled},
		{name: "link absent", tx: paired(t, StatusCleared), version: 2, link: uuid.Must(uuid.NewV7()), before: before, wantErr: ErrValidation},
		{name: "card credit", tx: paired(t, StatusCleared), version: 2, link: link, before: credit, wantErr: ErrValidation},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := tt.tx.Unpair(tt.version, tt.link, tt.before, f.accounts)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Unpair error = %v, want %v", err, tt.wantErr)
			}

			if tt.wantErr != nil {
				return
			}

			if got.Version != 3 || len(got.Postings) != len(tt.want) {
				t.Fatalf("Unpair = version %d, %d postings", got.Version, len(got.Postings))
			}

			for i, w := range tt.want {
				p := got.Postings[i]
				if p.AccountID != w.AccountID || p.Amount != w.Amount || p.ExternalRecordID != uuid.Nil {
					t.Fatalf("posting %d = %+v, want account %s amount %s unlinked", i, p, w.AccountID, w.Amount)
				}
			}
		})
	}
}
