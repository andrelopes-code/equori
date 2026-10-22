package domain

import (
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestReimburse(t *testing.T) {
	t.Parallel()
	f := newCategorizeFixture(t)
	spent := func(food, cleaning int64) Transaction {
		return f.record(t,
			Posting{AccountID: f.checking.ID, Amount: brl(t, -(food + cleaning))},
			Posting{AccountID: f.food.ID, Amount: brl(t, food)},
			Posting{AccountID: f.cleaning.ID, Amount: brl(t, cleaning)},
		)
	}
	inflow := func(amount int64) Transaction {
		return f.record(t, Posting{AccountID: f.checking.ID, Amount: brl(t, amount)}, Posting{AccountID: f.income.ID, Amount: brl(t, -amount)})
	}
	voided := func(tx Transaction) Transaction {
		at := time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC)
		tx.VoidedAt = &at
		return tx
	}
	usdSpent := f.record(t,
		Posting{AccountID: f.checking.ID, Amount: brl(t, -1000), Weight: brl(t, -1000)},
		Posting{AccountID: f.food.ID, Amount: brl(t, 1000), Weight: brl(t, 1000)},
	)
	usdSpent.Postings[1].AccountID, usdSpent.Postings[1].Amount = f.usdFood.ID, mustMoney(t, 1000, "USD")
	original := spent(1000, 500)
	second := f.record(t, Posting{AccountID: f.checking.ID, Amount: brl(t, -400)}, Posting{AccountID: f.food.ID, Amount: brl(t, 400)})
	categories := func(tx Transaction) []int64 {
		var out []int64
		for _, p := range tx.Postings {
			if f.accounts[p.AccountID].IsCategory() {
				out = append(out, p.Amount.Amount())
			}
		}
		slices.Sort(out)
		return out
	}
	reimburse := func(tx Transaction, version int, allocations ...Allocation) (Transaction, error) {
		return tx.Reimburse(version, allocations, f.income, f.accounts)
	}

	t.Run("allocates the amount over the categories of the expense and keeps the rest uncategorized", func(t *testing.T) {
		t.Parallel()
		got, err := reimburse(inflow(1500), 1, Allocation{Original: original, Amount: 300})
		if err != nil {
			t.Fatal(err)
		}
		if want := []int64{-1200, -200, -100}; !slices.Equal(categories(got), want) {
			t.Fatalf("category amounts = %v, want %v", categories(got), want)
		}
		if got.Version != 2 {
			t.Fatalf("version = %d, want 2", got.Version)
		}
		if want := []Link{{Type: LinkReimbursementOf, Target: original.ID, Amount: 300}}; !slices.Equal(got.Links, want) {
			t.Fatalf("links = %+v, want %+v", got.Links, want)
		}
	})

	t.Run("several expenses take their own amounts", func(t *testing.T) {
		t.Parallel()
		got, err := reimburse(inflow(1000), 1, Allocation{Original: original, Amount: 600}, Allocation{Original: second, Amount: 400})
		if err != nil {
			t.Fatal(err)
		}
		if want := []int64{-400, -400, -200}; !slices.Equal(categories(got), want) {
			t.Fatalf("category amounts = %v, want %v", categories(got), want)
		}
		if len(got.Links) != 2 || got.Links[0].Amount != 600 || got.Links[1].Amount != 400 {
			t.Fatalf("links = %+v", got.Links)
		}
	})

	t.Run("replaces earlier reimbursement links and keeps the others", func(t *testing.T) {
		t.Parallel()
		next := inflow(1000)
		other := uuid.Must(uuid.NewV7())
		next.Links = []Link{{Type: LinkReimbursementOf, Target: second.ID, Amount: 100}, {Type: LinkRefundOf, Target: other}}
		got, err := reimburse(next, 1, Allocation{Original: original, Amount: 500})
		if err != nil {
			t.Fatal(err)
		}
		want := []Link{{Type: LinkRefundOf, Target: other}, {Type: LinkReimbursementOf, Target: original.ID, Amount: 500}}
		if !slices.Equal(got.Links, want) {
			t.Fatalf("links = %+v, want %+v", got.Links, want)
		}
	})

	t.Run("an empty list returns the inflow to uncategorized income", func(t *testing.T) {
		t.Parallel()
		reimbursed := inflow(1000)
		reimbursed.Links = []Link{{Type: LinkReimbursementOf, Target: original.ID, Amount: 1000}}
		got, err := reimburse(reimbursed, 1)
		if err != nil {
			t.Fatal(err)
		}
		if want := []int64{-1000}; !slices.Equal(categories(got), want) || len(got.Links) != 0 {
			t.Fatalf("categories = %v links = %+v", categories(got), got.Links)
		}
	})

	tests := []struct {
		name   string
		tx     Transaction
		allocs []Allocation
		want   error
		field  string
	}{
		{"stale version", inflow(300), []Allocation{{Original: original, Amount: 300}}, ErrVersionConflict, ""},
		{"voided inflow", voided(inflow(300)), []Allocation{{Original: original, Amount: 300}}, ErrVoided, ""},
		{"voided expense", inflow(300), []Allocation{{Original: voided(original), Amount: 300}}, ErrVoided, ""},
		{"outflow", f.record(t, Posting{AccountID: f.checking.ID, Amount: brl(t, -300)}, Posting{AccountID: f.uncategorized.ID, Amount: brl(t, 300)}), []Allocation{{Original: original, Amount: 300}}, ErrNotCategorizable, ""},
		{"transfer", f.record(t, Posting{AccountID: f.checking.ID, Amount: brl(t, 300)}, Posting{AccountID: f.savings.ID, Amount: brl(t, -300)}), []Allocation{{Original: original, Amount: 300}}, ErrNotCategorizable, ""},
		{"income original", inflow(300), []Allocation{{Original: inflow(1500), Amount: 300}}, ErrValidation, "allocations[0].original_id"},
		{"foreign currency original", inflow(300), []Allocation{{Original: usdSpent, Amount: 300}}, ErrValidation, "allocations[0].original_id"},
		{"above the remaining amount", inflow(300), []Allocation{{Original: original, Amount: 300, HeldByOthers: 1300}}, ErrValidation, "allocations[0].original_id"},
		{"exactly the remaining amount", inflow(200), []Allocation{{Original: original, Amount: 200, HeldByOthers: 1300}}, nil, ""},
		{"zero amount", inflow(300), []Allocation{{Original: original, Amount: 0}}, ErrValidation, "allocations[0].amount"},
		{"negative amount", inflow(300), []Allocation{{Original: original, Amount: -1}}, ErrValidation, "allocations[0].amount"},
		{"duplicate expense", inflow(300), []Allocation{{Original: original, Amount: 100}, {Original: original, Amount: 100}}, ErrValidation, "allocations[1].original_id"},
		{"above the inflow", inflow(300), []Allocation{{Original: original, Amount: 200}, {Original: second, Amount: 200}}, ErrValidation, "allocations"},
		{"empty list without a reimbursement", inflow(300), nil, ErrValidation, "allocations"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			version := 1
			if tt.name == "stale version" {
				version = 4
			}
			_, err := reimburse(tt.tx, version, tt.allocs...)
			if !errors.Is(err, tt.want) {
				t.Fatalf("err = %v, want %v", err, tt.want)
			}
			var fe *FieldError
			if tt.field != "" && (!errors.As(err, &fe) || fe.Field != tt.field) {
				t.Fatalf("err = %v, want field %q", err, tt.field)
			}
		})
	}

	t.Run("refuses the transaction itself", func(t *testing.T) {
		t.Parallel()
		self := inflow(300)
		_, err := reimburse(self, 1, Allocation{Original: self, Amount: 100})
		var fe *FieldError
		if !errors.Is(err, ErrValidation) || !errors.As(err, &fe) || fe.Field != "allocations[0].original_id" {
			t.Fatalf("err = %v, want validation on allocations[0].original_id", err)
		}
	})
}
