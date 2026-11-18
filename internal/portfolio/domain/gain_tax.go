package domain

import "time"

// The pools of the monthly tax on the gains of variable income (monthly gain tax design GT1).
const (
	PoolOrdinary = "ordinary"
	PoolDayTrade = "day_trade"
	PoolFII      = "fii"
	// PoolCrypto is crypto sold on an exchange of the country: a capital gain with its own DARF.
	PoolCrypto = "crypto"
)

// TaxSale is one realized result read by the monthly tax: its month, kind and tax class, its gross
// sale value, its result and the tax withheld at source on it, in minor units of the base
// currency.
type TaxSale struct {
	Month                   time.Time
	Kind, TaxClass          string
	Gross, Result, Withheld int64
}

// TaxLine is the tax of one pool in one month. Exempt is the gain the exemption removed; LossUsed
// the carried loss spent; LossCarried the loss left after the month; Due the tax less the tax
// withheld, never below zero.
type TaxLine struct {
	Pool                        string
	Gross, Result, Exempt       int64
	LossUsed, LossCarried, Base int64
	RateBP                      int
	Tax, Withheld, Due          int64
}

// TaxMonth is the tax of the months with sales. Darf is the amount to pay for the stock, day-trade
// and FII pools; CarriedIn the amount below the minimum a previous month left, included in Darf
// or carried again. CryptoDarf and CryptoCarriedIn are the same for the crypto pool, paid apart.
type TaxMonth struct {
	Month           time.Time
	Lines           []TaxLine
	CarriedIn       int64
	Darf            int64
	CryptoCarriedIn int64
	CryptoDarf      int64
}
