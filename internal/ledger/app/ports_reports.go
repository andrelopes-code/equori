package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// reportStore holds the Repository methods of balances, investment trees and category totals.
type reportStore interface {
	// BalanceAt sums the postings of the account and its descendants up to and including date.
	BalanceAt(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		date time.Time,
		basis Basis,
	) (int64, error)
	// BalancesAt sums the postings of each asset and liability account up to and including
	// date, ordered by account name then id.
	BalancesAt(
		ctx context.Context,
		booksID int64,
		date time.Time,
		basis Basis,
	) ([]AccountTotal, error)
	TreeInstruments(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
	) ([]money.Currency, error)
	SecurityPostings(
		ctx context.Context,
		booksID int64,
		accountIDs []uuid.UUID,
	) ([]HoldingPosting, error)
	SecurityTrades(ctx context.Context, booksID int64, accountIDs []uuid.UUID) ([]TradeFact, error)
	SecurityIncomes(
		ctx context.Context,
		booksID int64,
		accountIDs []uuid.UUID,
	) ([]IncomeFact, error)
	Holding(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		date time.Time,
	) (quantity, costBasis int64, err error)
	LaterSaleExists(
		ctx context.Context,
		booksID int64,
		accountIDs []uuid.UUID,
		date time.Time,
		exclude uuid.UUID,
	) (bool, error)
	TreeBalancesByInstrument(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		date time.Time,
		basis Basis,
	) (map[money.Currency]int64, error)
	// TreeExternalFlows returns, per transaction of [from, to] that touches the tree of the accounts
	// and a balance account outside it, the money that entered the tree (negative when it left).
	TreeExternalFlows(
		ctx context.Context,
		booksID int64,
		accountIDs []uuid.UUID,
		from, to time.Time,
	) ([]ExternalFlow, error)
	// TreeFirstPosting returns the booked date of the earliest posting of the tree of the accounts.
	TreeFirstPosting(
		ctx context.Context,
		booksID int64,
		accountIDs []uuid.UUID,
	) (time.Time, bool, error)
	// TreeRecordedYield returns the flows of R19, the yield credits and the other income and expense
	// amounts of the transactions of [from, to] that touch the tree of the accounts.
	TreeRecordedYield(
		ctx context.Context,
		booksID int64,
		accountIDs []uuid.UUID,
		from, to time.Time,
	) (RecordedYield, error)
	// CategoryTotal sums the weights of the non-voided postings of the account and its
	// descendants booked in [from, to).
	CategoryTotal(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		from, to time.Time,
	) (int64, error)
	// CategoryMonthlyTotals returns CategoryTotal by first day of month, months without postings omitted.
	CategoryMonthlyTotals(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		from, to time.Time,
	) (map[time.Time]int64, error)
	// OwnCategoryMonthlyTotals returns the own postings of every category of class by month in [from, to).
	OwnCategoryMonthlyTotals(
		ctx context.Context,
		booksID int64,
		class string,
		from, to time.Time,
	) ([]CategoryMonth, error)
}
