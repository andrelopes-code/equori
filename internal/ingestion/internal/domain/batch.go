// Package domain holds the import batch, its external records and the rules that turn
// statement lines into ledger facts (chapter 5, 5.5).
package domain

import (
	"time"

	"github.com/google/uuid"
)

type Source string

const (
	SourceOFX Source = "ofx"
	SourceCSV Source = "csv"
	// SourceAggregator is a sync of one mapped account from an aggregator (P6 A36).
	SourceAggregator Source = "aggregator"
)

// Counts are the records of one batch by outcome; Received is the number of lines read.
// Updated and Withdrawn count stored records an aggregator changed or stopped returning.
type Counts struct {
	Received, Ignored, Matched, Created, NeedsReview, Discarded, Updated, Withdrawn int
}

type BalanceStatus string

const (
	BalanceNone     BalanceStatus = "none"
	BalanceRecorded BalanceStatus = "recorded"
	BalanceSkipped  BalanceStatus = "skipped"
)

// FileBalance is the balance a file reports and what became of it (chapter 3, F4).
type FileBalance struct {
	Status BalanceStatus
	Date   *time.Time
	Amount int64
	Reason string
}

// Batch is one file import or one sync of a mapped account (an import batch).
type Batch struct {
	ID        uuid.UUID
	UserID    int64
	AccountID uuid.UUID
	Source    Source
	FileName  string // empty for a sync
	// ExternalAccountID is the mapped account a sync read; nil for files and after the
	// connection is deleted.
	ExternalAccountID *uuid.UUID
	Currency          string
	PeriodFrom        *time.Time
	PeriodTo          *time.Time
	Counts            Counts
	Balance           FileBalance
	StartedAt         time.Time
	CompletedAt       *time.Time
}
