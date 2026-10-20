package domain

import (
	"math/rand/v2"
	"testing"

	"github.com/google/uuid"
)

// N02: a transaction is accepted if and only if its weights sum to zero.
func TestNewTransactionAcceptsOnlyBalanced(t *testing.T) {
	t.Parallel()
	f := newTxFixture(t)
	open := []uuid.UUID{f.checking.ID, f.food.ID}
	for seed := uint64(1); seed <= 200; seed++ {
		r := rand.New(rand.NewPCG(seed, seed))
		n := 2 + r.IntN(7)
		postings := make([]Posting, 0, n)
		var sum int64
		for i := range n {
			amount := r.Int64N(2_000_000) - 1_000_000
			if amount == 0 {
				amount = 1
			}
			if i == n-1 && r.IntN(2) == 0 && sum != 0 {
				amount = -sum
			}
			sum += amount
			postings = append(postings, Posting{AccountID: open[r.IntN(len(open))], Amount: brl(t, amount)})
		}

		got, err := NewTransaction(f.tx(postings...), f.accounts)

		if (err == nil) != (sum == 0) {
			t.Fatalf("seed %d: sum %d, err %v", seed, sum, err)
		}
		if err == nil {
			for i := range postings {
				if got.Postings[i].Amount != postings[i].Amount || got.Postings[i].AccountID != postings[i].AccountID {
					t.Fatalf("seed %d: posting %d changed", seed, i)
				}
			}
		}
	}
}
