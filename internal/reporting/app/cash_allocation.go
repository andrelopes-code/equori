package app

import (
	"time"

	"github.com/google/uuid"
)

type payment struct {
	date, reference              time.Time
	card, statement, transaction uuid.UUID
	shares                       Shares
}

// allocate applies each payment to the oldest statement of its card that is still owed (CV4)
// and returns the cash payments with the categories of every card line (CV2, CV7).
func allocate(f CardFacts) ([]payment, map[uuid.UUID]Shares) {
	financing := map[uuid.UUID]bool{}
	for _, p := range f.Payments {
		if p.Financing {
			financing[p.TransactionID] = true
		}
	}

	categories := lineCategories(f)
	type bucket struct {
		card, id  uuid.UUID
		statement time.Time
		shares    Shares
	}
	var buckets []*bucket
	bucketOf := map[uuid.UUID]*bucket{}

	byTx := map[uuid.UUID][]CardLine{}
	for _, l := range f.Lines {
		if !l.Base {
			continue
		}

		if financing[l.TransactionID] {
			// CV7: an installment of a financing has no categories until the financing applies.
			categories[l.ID] = Shares{}
		}

		if n := len(buckets); n == 0 || buckets[n-1].card != l.CardID || !buckets[n-1].statement.Equal(l.Statement) {
			buckets = append(buckets, &bucket{card: l.CardID, id: l.StatementID, statement: l.Statement, shares: Shares{}})
		}

		bucketOf[l.ID] = buckets[len(buckets)-1]
		byTx[l.TransactionID] = append(byTx[l.TransactionID], l)
		add(buckets[len(buckets)-1].shares, categories[l.ID])
	}

	var out []payment
	for _, p := range f.Payments {
		// A statement owing nothing passes what it holds to the next statement of its card (CV8).
		for i, b := range buckets[:max(len(buckets)-1, 0)] {
			if sum(b.shares) <= 0 && buckets[i+1].card == b.card {
				add(buckets[i+1].shares, b.shares)
				b.shares = Shares{}
			}
		}

		left := p.Amount

		moved := Shares{}
		for _, b := range buckets {
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

			if p.Financing {
				add(moved, share)
				continue
			}

			out = append(out, payment{date: p.Date, card: p.CardID, statement: b.id, reference: b.statement, transaction: p.TransactionID, shares: share})
		}

		if !p.Financing {
			continue
		}

		// CV7: the principal moves into the installments beside the financing's interest.
		rest := clone(f.Categories[p.TransactionID])
		add(rest, moved)

		for _, l := range spread(byTx[p.TransactionID], rest) {
			add(bucketOf[l.id].shares, l.shares)
			categories[l.id] = l.shares
		}
	}

	return out, categories
}

type lineShares struct {
	id     uuid.UUID
	shares Shares
}

// spread distributes rest over lines in proportion to their amounts, the last line taking
// what is left (CV2).
func spread(lines []CardLine, rest Shares) []lineShares {
	out := make([]lineShares, len(lines))
	for i, l := range lines {
		if i == len(lines)-1 {
			out[i] = lineShares{l.ID, rest}
			break
		}

		share := distribute(-l.Amount, rest)
		out[i] = lineShares{l.ID, share}
		rest = clone(rest)
		add(rest, negate(share))
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

		for _, l := range spread(others, rest) {
			out[l.id] = l.shares
		}
	}

	return out
}
