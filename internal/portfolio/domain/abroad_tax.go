package domain

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
