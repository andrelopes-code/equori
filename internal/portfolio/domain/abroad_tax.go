package domain

import (
	"math/big"
	"time"

	"github.com/google/uuid"
)

// AbroadItem is a gain, a loss or an income of a financial investment held abroad, in minor units
// of the base currency: Amount is the result of a sale or the gross of an income, Withheld the
// tax paid abroad on it (coverage row U-08).
type AbroadItem struct {
	Year             int
	Amount, Withheld int64
}

// AbroadYear is the annual tax of the financial investments held abroad: Gains and Losses are the
// sums of the items of the year, LossUsed the losses carried in that the gains spend, LossCarried
// the loss left for later years, Base the taxed amount, Credit the tax paid abroad deducted and Due
// the tax to pay in the annual return.
type AbroadYear struct {
	Year                  int
	Gains, Losses         int64
	LossUsed, LossCarried int64
	Base, Tax             int64
	RateBP                int
	Credit, Due           int64
}

// BalancePosting is one posting of a balance account in a currency other than the base: Amount in
// units of that currency and Weight in minor units of the base currency, both signed like the
// posting. Remunerated is true for an account with yield_mode auto; BaseBalanced is true when
// the transaction balances in the base currency.
type BalancePosting struct {
	AccountID, TransactionID  uuid.UUID
	Date                      time.Time
	Amount, Weight            int64
	Remunerated, BaseBalanced bool
}

// foreignBalance is the units held in an account and their cost in minor units of the base.
type foreignBalance struct{ units, cost int64 }

// ExchangeItems are the exchange results of the remunerated balances abroad (Lei 14.754/2023 art.
// 3 § 2), from postings ordered by date and grouped by transaction. Per account, a posting of a
// transaction balanced in the base currency that adds units adds them at its weight; one that
// removes units realizes |weight| − units × average cost as an item of its year and lowers the
// cost by units × average cost. A transaction balanced in another currency moves units at the
// average cost without an item: its inflows take the cost its outflows removed, or the average
// cost of their own account when it has no outflow. units × average cost is units × cost ÷ held,
// rounded half to even in minor units of the base. An account without yield gives no item
// (art. 2 § 3).
func ExchangeItems(ps []BalancePosting) []AbroadItem {
	held := map[uuid.UUID]*foreignBalance{}

	var out []AbroadItem

	for start := 0; start < len(ps); {
		end := start + 1
		for end < len(ps) && ps[end].TransactionID == ps[start].TransactionID {
			end++
		}

		out = append(out, replayTransaction(held, ps[start:end])...)
		start = end
	}

	return out
}

// replayTransaction applies the postings of one transaction, outflows first, so that an inflow
// of a transfer finds the cost its outflow removed.
func replayTransaction(held map[uuid.UUID]*foreignBalance, group []BalancePosting) []AbroadItem {
	var inflows, outflows []BalancePosting

	// Every balance abroad keeps its cost, so a transfer carries it; only a remunerated balance
	// realizes an item (Lei 14.754/2023, art. 2, § 3).
	for _, p := range group {
		if p.Amount > 0 {
			inflows = append(inflows, p)
		} else {
			outflows = append(outflows, p)
		}
	}

	out, pool := replayOutflows(held, outflows)
	replayInflows(held, inflows, pool)

	return out
}

// replayOutflows removes the units of each outflow at its balance's average cost. One balanced in
// the base currency realizes an item when its balance is remunerated; one balanced in another
// currency leaves its units and cost in the pool of the transaction.
func replayOutflows(
	held map[uuid.UUID]*foreignBalance,
	outflows []BalancePosting,
) ([]AbroadItem, *foreignBalance) {
	var out []AbroadItem

	pool := &foreignBalance{}

	for _, p := range outflows {
		b := balanceOf(held, p.AccountID)
		cost := averageCost(b, -p.Amount)
		b.units += p.Amount
		b.cost -= cost

		switch {
		case p.BaseBalanced && p.Remunerated:
			out = append(
				out,
				AbroadItem{Year: p.Date.Year(), Amount: max(p.Weight, -p.Weight) - cost},
			)
		case !p.BaseBalanced:
			pool.units -= p.Amount
			pool.cost += cost
		}
	}

	return out, pool
}

// replayInflows adds the units of each inflow: at its weight when the transaction balances in the
// base currency, else at the cost of the pool its outflows left, or at its balance's own average
// cost when the pool is empty.
func replayInflows(
	held map[uuid.UUID]*foreignBalance,
	inflows []BalancePosting,
	pool *foreignBalance,
) {
	for _, p := range inflows {
		b := balanceOf(held, p.AccountID)
		cost := p.Weight

		if !p.BaseBalanced {
			cost = averageCost(pool, p.Amount)
			if pool.units == 0 {
				cost = averageCost(b, p.Amount)
			}

			pool.units -= p.Amount
			pool.cost -= cost
		}

		b.units += p.Amount
		b.cost += cost
	}
}

func balanceOf(held map[uuid.UUID]*foreignBalance, id uuid.UUID) *foreignBalance {
	if held[id] == nil {
		held[id] = &foreignBalance{}
	}

	return held[id]
}

// averageCost is units × cost ÷ held of b, rounded half to even; zero when b holds nothing.
func averageCost(b *foreignBalance, units int64) int64 {
	if b.units <= 0 {
		return 0
	}

	return halfEven(new(big.Rat).SetFrac(
		new(big.Int).Mul(big.NewInt(units), big.NewInt(b.cost)),
		big.NewInt(b.units),
	))
}
