package app

import (
	"bytes"
	"context"
	"math/big"
	"slices"
	"time"

	"github.com/google/uuid"
)

// View chooses when an amount counts (docs/domain/02-ubiquitous-language.md).
type View string

const (
	ViewAccrual View = "accrual"
	ViewCash    View = "cash"
)

// CardLine is a charge or credit posting of a card, with the reference month of its
// statement (CV1). Base is true on a card in the base currency (CV6); PlanPurchase is the date
// of the purchase of the line's installment plan; Anticipation marks a line of a transaction
// linked anticipation_of.
type CardLine struct {
	ID, TransactionID, CardID uuid.UUID
	Amount                    int64
	Credit                    bool
	Statement                 time.Time
	Base                      bool
	PlanPurchase              *time.Time
	Anticipation              bool
}

type CardPayment struct {
	ID, CardID uuid.UUID
	Date       time.Time
	Amount     int64
}

// Shares are amounts per category, signed as the category postings.
type Shares map[uuid.UUID]int64

// CardFacts are the card lines and payments of a user, the category postings of the
// transactions that hold the lines or that a line's transaction anticipates or cancels, and
// that purchase per transaction.
type CardFacts struct {
	Lines      []CardLine
	Payments   []CardPayment
	Categories map[uuid.UUID]Shares
	Origins    map[uuid.UUID]uuid.UUID
}

type CashRepository interface {
	CardFacts(ctx context.Context, userID int64, to time.Time) (CardFacts, error)
	// OffCardTotals sums, per category, the postings in [from, to] of transactions without a card line.
	OffCardTotals(ctx context.Context, userID int64, from, to time.Time) (Shares, error)
}

// cashTotals is the cash view of [from, to] per category (CV1 to CV5).
func (s *Service) cashTotals(ctx context.Context, userID int64, from, to time.Time) (Shares, error) {
	out, err := s.repo.OffCardTotals(ctx, userID, from, to)
	if err != nil {
		return nil, err
	}
	facts, err := s.repo.CardFacts(ctx, userID, to)
	if err != nil {
		return nil, err
	}
	for _, p := range paid(facts) {
		if !p.date.Before(from) && !p.date.After(to) {
			add(out, p.shares)
		}
	}
	return out, nil
}

type payment struct {
	date   time.Time
	shares Shares
}

// paid applies each payment to the oldest statement of its card that is still owed (CV4).
func paid(f CardFacts) []payment {
	categories := lineCategories(f)
	type bucket struct {
		card      uuid.UUID
		statement time.Time
		shares    Shares
	}
	var buckets []*bucket
	for _, l := range f.Lines {
		if !l.Base {
			continue
		}
		if n := len(buckets); n == 0 || buckets[n-1].card != l.CardID || !buckets[n-1].statement.Equal(l.Statement) {
			buckets = append(buckets, &bucket{card: l.CardID, statement: l.Statement, shares: Shares{}})
		}
		add(buckets[len(buckets)-1].shares, categories[l.ID])
	}
	// A statement owing nothing passes what it holds to the next statement of its card.
	var owed []*bucket
	for i, b := range buckets {
		if sum(b.shares) > 0 {
			owed = append(owed, b)
		} else if i+1 < len(buckets) && buckets[i+1].card == b.card {
			add(buckets[i+1].shares, b.shares)
		}
	}
	var out []payment
	for _, p := range f.Payments {
		left := p.Amount
		for _, b := range owed {
			if left <= 0 {
				break
			}
			due := sum(b.shares)
			if b.card != p.CardID || due <= 0 {
				continue
			}
			share := distribute(min(left, due), b.shares)
			add(b.shares, negate(share))
			left -= min(left, due)
			out = append(out, payment{date: p.Date, shares: share})
		}
	}
	return out
}

// lineCategories gives each card line its categories (CV2).
func lineCategories(f CardFacts) map[uuid.UUID]Shares {
	byTx := map[uuid.UUID][]CardLine{}
	var txs []uuid.UUID
	for _, l := range f.Lines {
		if _, ok := byTx[l.TransactionID]; !ok {
			txs = append(txs, l.TransactionID)
		}
		byTx[l.TransactionID] = append(byTx[l.TransactionID], l)
	}
	cardTotal := map[uuid.UUID]int64{}
	for _, l := range f.Lines {
		cardTotal[l.TransactionID] -= l.Amount
	}
	out := map[uuid.UUID]Shares{}
	for _, tx := range txs {
		lines := byTx[tx]
		rest := Shares{}
		add(rest, f.Categories[tx])
		var others []CardLine
		origin, reverses := f.Origins[tx]
		for _, l := range lines {
			if reverses && l.Credit && cardTotal[origin] != 0 {
				share := scale(-l.Amount, cardTotal[origin], f.Categories[origin])
				out[l.ID] = share
				add(rest, negate(share))
				continue
			}
			others = append(others, l)
		}
		for i, l := range others {
			if i == len(others)-1 {
				out[l.ID] = rest
				break
			}
			share := distribute(-l.Amount, rest)
			out[l.ID] = share
			rest = clone(rest)
			add(rest, negate(share))
		}
	}
	return out
}

// distribute splits x over the categories in proportion to weights: ⌊x·w/D⌋ each, and the
// amount left to the largest weight, ties to the lowest category id (CV5).
func distribute(x int64, weights Shares) Shares {
	return scale(x, sum(weights), weights)
}

// scale gives each category ⌊x·w/d⌋ and the amount left by the rounding to the largest
// weight in absolute value, ties to the lowest category id.
func scale(x, d int64, weights Shares) Shares {
	out := Shares{}
	if d == 0 || len(weights) == 0 {
		return out
	}
	ids := make([]uuid.UUID, 0, len(weights))
	for id := range weights {
		ids = append(ids, id)
	}
	slices.SortFunc(ids, func(a, b uuid.UUID) int { return bytes.Compare(a[:], b[:]) })
	var given int64
	largest := ids[0]
	for _, id := range ids {
		w := weights[id]
		out[id] = floorDiv(x, w, d)
		given += out[id]
		if abs(w) > abs(weights[largest]) {
			largest = id
		}
	}
	out[largest] += floorDiv(x, sum(weights), d) - given
	return out
}

// floorDiv is ⌊a·b/d⌋ without overflow.
func floorDiv(a, b, d int64) int64 {
	q, m := new(big.Int).DivMod(new(big.Int).Mul(big.NewInt(a), big.NewInt(b)), big.NewInt(d), new(big.Int))
	// DivMod is Euclidean: for a negative divisor it rounds up when there is a remainder.
	if d < 0 && m.Sign() != 0 {
		q.Sub(q, big.NewInt(1))
	}
	return q.Int64()
}

func abs(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}

func sum(s Shares) int64 {
	var n int64
	for _, v := range s {
		n += v
	}
	return n
}

func add(to, from Shares) {
	for id, v := range from {
		to[id] += v
	}
}

func negate(s Shares) Shares {
	out := make(Shares, len(s))
	for id, v := range s {
		out[id] = -v
	}
	return out
}

func clone(s Shares) Shares {
	out := make(Shares, len(s))
	add(out, s)
	return out
}
