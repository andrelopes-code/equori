package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// Ledger is read through ledger.Module (ADR 002).
type Ledger interface {
	AccountFacts(ctx context.Context, booksID int64) ([]Account, error)
	InvestmentFacts(ctx context.Context, booksID int64, brokerageID uuid.UUID) (domain.Facts, error)
	BaseCurrency(ctx context.Context, booksID int64) (money.Currency, error)
	// Today is the current date of the book time zone (CN5).
	Today(ctx context.Context) time.Time
	// ValuedBalance values the account and its sub-accounts at the end of date in currency in; the
	// error wraps ErrNotFound for an unknown account and ErrPriceMissing for a missing price.
	ValuedBalance(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		date time.Time,
		in money.Currency,
	) (money.Money, error)
	// ExternalFlows takes the accounts as one tree; FirstPosting is the earliest booked date of it.
	ExternalFlows(
		ctx context.Context,
		booksID int64,
		accountIDs []uuid.UUID,
		from, to time.Time,
	) ([]Flow, error)
	FirstPosting(
		ctx context.Context,
		booksID int64,
		accountIDs []uuid.UUID,
	) (time.Time, bool, error)
	// RecordedYield is what the ledger records of the tree of the accounts in [from, to]: the flows
	// that are not yield, the yield credits and the other income and expense amounts (amendment A208
	// R19).
	RecordedYield(
		ctx context.Context,
		booksID int64,
		accountIDs []uuid.UUID,
		from, to time.Time,
	) (Recorded, error)
	// Balances is the balance of every asset and liability account at the end of date, each in
	// its own instrument and counting its own postings only.
	Balances(ctx context.Context, booksID int64, date time.Time) ([]AccountBalance, error)
	// UnitTaxDates are the dates of the unit taxes recorded on the account in [from, to].
	UnitTaxDates(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		from, to time.Time,
	) ([]time.Time, error)
	// EstimateWithholding is the income tax and IOF a sale of units of the security for
	// proceedsMinor would withhold on date, and the net it leaves after them and the custody fee;
	// ok is false when the account has no withholding table.
	EstimateWithholding(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		date time.Time,
		units, proceedsMinor int64,
	) (tax, net money.Money, ok bool, err error)
}

// Jurisdictions gives the tax jurisdiction of a book; a nil result means none applies.
type Jurisdictions interface {
	For(ctx context.Context, booksID int64) (domain.Jurisdiction, error)
}

// MarketData values quantities; Convert returns an error wrapping ErrPriceMissing when no
// price path exists.
type MarketData interface {
	Scale(ctx context.Context, code money.Currency) (int, error)
	// InstrumentOf returns the type and the quotation currency of an instrument; a currency
	// has no quotation currency.
	InstrumentOf(ctx context.Context, code money.Currency) (InstrumentInfo, error)
	Convert(
		ctx context.Context,
		q money.Money,
		to money.Currency,
		date time.Time,
	) (money.Money, []Price, error)
	// WarmCurrent asks for the current quotes of codes and of their quote currencies, and waits a
	// bounded time; it never fails (A248 CQ18).
	WarmCurrent(ctx context.Context, codes []money.Currency)
	// ConvertCurrent values q in to now; it returns the errors of Convert (A248 CQ16).
	ConvertCurrent(
		ctx context.Context,
		q money.Money,
		to money.Currency,
	) (money.Money, []Price, error)
	// IndexRates returns the rates of a daily index in [from, to], oldest first: ErrUnknownIndex
	// when the index is not enabled or has no rate, ErrIndexNotDaily when its period is not a day.
	IndexRates(ctx context.Context, id string, from, to time.Time) ([]IndexRate, error)
	// BenchmarkIndex returns the default index of the book's region, or "" (amendment A208 R2).
	BenchmarkIndex(ctx context.Context, booksID int64) (string, error)
	// YearBasis returns the rate days of a year on which an index is quoted, or 0 when unknown
	// (amendment A208 R9).
	YearBasis(index string) int
	// IndexCurrency returns the currency an index belongs to, or "" when unknown (R15).
	IndexCurrency(index string) money.Currency
	// InflationIndex returns the default inflation index of the book's region, or "" (R16).
	InflationIndex(ctx context.Context, booksID int64) (string, error)
	// MonthlyRates returns the rates of a monthly index in [from, to], oldest first, each dated
	// on the first day of its month: ErrUnknownIndex when the index is not enabled or has no
	// rate, ErrIndexNotMonthly when its period is not a month.
	MonthlyRates(ctx context.Context, id string, from, to time.Time) ([]IndexRate, error)
	// QuoteState returns the first and last dates with a price of code, nil when none is stored,
	// and whether its next price is overdue (A222 MQ24).
	QuoteState(
		ctx context.Context,
		code money.Currency,
	) (first, last *time.Time, stale bool, err error)
	// Coupons returns the per-unit coupon of each payment of a fixed income instrument, in date
	// order (A236 FC8).
	Coupons(ctx context.Context, code money.Currency) ([]Coupon, error)
	// Maturity returns the maturity date of the terms of code; false when it has none.
	Maturity(ctx context.Context, code money.Currency) (time.Time, bool, error)
	// ContractFacts returns the facts of a fixed income security (GR3); false when it has none.
	ContractFacts(ctx context.Context, code money.Currency) (ContractFacts, bool, error)
	// Adjust moves d to a business day of the calendar: the preceding one, else the following.
	Adjust(ctx context.Context, calendar string, d time.Time, preceding bool) (time.Time, error)
}

// Repository stores the portfolio tables; postgres/ implements it.
type Repository interface {
	Replace(ctx context.Context, booksID int64, accountIDs []uuid.UUID, r domain.Rebuilt) error
	PositionsAt(ctx context.Context, booksID int64, date time.Time) ([]domain.PositionDay, error)
	RealizedResults(
		ctx context.Context,
		booksID int64,
		from, to time.Time,
	) ([]domain.RealizedResult, error)
	IncomeEvents(
		ctx context.Context,
		booksID int64,
		from, to time.Time,
	) ([]domain.IncomeEvent, error)
	BooksToRebuild(ctx context.Context) ([]int64, error)
	ContributionPlan(ctx context.Context, booksID int64) (domain.Plan, bool, error)
	SaveContributionPlan(ctx context.Context, booksID int64, p domain.Plan) error
}
