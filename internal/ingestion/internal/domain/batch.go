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
)

// Counts are the records of one file by outcome; Received is the number of lines read.
type Counts struct {
	Received, Ignored, Matched, Created, NeedsReview, Discarded int
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

// Batch is one file import (an import batch).
type Batch struct {
	ID          uuid.UUID
	UserID      int64
	AccountID   uuid.UUID
	Source      Source
	FileName    string
	Currency    string
	PeriodFrom  *time.Time
	PeriodTo    *time.Time
	Counts      Counts
	Balance     FileBalance
	StartedAt   time.Time
	CompletedAt *time.Time
}
