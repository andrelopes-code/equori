package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
)

// Ledger event types, as the module root maps them.
const (
	EventRecorded    = "recorded"
	EventCorrected   = "corrected"
	EventCategorized = "categorized"
	EventVoided      = "voided"
)

// Category states and origins of the ledger (P5 amendment A17).
const (
	stateNone          = "none"
	stateUncategorized = "uncategorized"
	originImport       = "import"
	originSystem       = "system"
)

// errRecordPending makes a delivery retry: a correction that keeps the category postings
// keeps the method of a row that an earlier event has not written yet.
var errRecordPending = errors.New("categorization record not written yet")

// Event is a ledger transaction event (ADR 006).
type Event struct {
	Type              string
	UserID            int64
	TransactionID     uuid.UUID
	Version           int
	Date              time.Time
	Origin            string
	CategoryState     string
	CategoriesChanged bool
	Cause             Cause
	OccurredAt        time.Time
}

// Cause is who decided a categorization; Method is empty when the event carries none.
type Cause struct {
	Method string
	RuleID uuid.UUID
}

// Record is the categorization record of one transaction (P5 amendment A20); Method is
// empty while the transaction is uncategorized.
type Record struct {
	TransactionID uuid.UUID
	UserID        int64
	Version       int
	Date          time.Time
	Method        string
	RuleID        uuid.UUID
	// Corrected marks a manual change of the category postings (P5 amendment A24).
	Corrected  bool
	MatchKey   string
	CategoryID uuid.UUID
	Voided     bool
	DecidedAt  time.Time
}

// HandleEvent keeps the categorization record of e's transaction and runs F5 on a newly
// recorded uncategorized transaction. It runs in the outbox delivery's database
// transaction, so it calls the ledger before writing a row that references the ledger
// transaction (Global Constraints of the P5 plan).
func (s *Service) HandleEvent(ctx context.Context, e Event) error {
	if e.Origin == originSystem {
		return nil
	}
	if e.Type == EventVoided {
		return s.repo.MarkVoided(ctx, Record{TransactionID: e.TransactionID, UserID: e.UserID, Version: e.Version, Date: e.Date, DecidedAt: e.OccurredAt})
	}
	if e.CategoryState == stateNone {
		return s.repo.DeleteCategorization(ctx, e.UserID, e.TransactionID, e.Version)
	}
	rec := Record{TransactionID: e.TransactionID, UserID: e.UserID, Version: e.Version, Date: e.Date, DecidedAt: e.OccurredAt}
	switch {
	case e.CategoryState == stateUncategorized:
	case e.Cause.Method != "":
		rec.Method, rec.RuleID = e.Cause.Method, e.Cause.RuleID
		rec.Corrected = e.Cause.Method == MethodManual
	case e.Type == EventCorrected && !e.CategoriesChanged:
		prev, err := s.repo.Categorization(ctx, e.UserID, e.TransactionID)
		if errors.Is(err, ErrNotFound) {
			return errRecordPending
		}
		if err != nil {
			return err
		}
		rec.Method, rec.RuleID, rec.Corrected, rec.MatchKey, rec.CategoryID = prev.Method, prev.RuleID, prev.Corrected, prev.MatchKey, prev.CategoryID
	default:
		rec.Method = MethodManual
		rec.Corrected = e.Type == EventCorrected
	}
	if rec.Corrected && (e.Cause.Method != "" || e.CategoriesChanged) {
		if err := s.describeCorrection(ctx, &rec); err != nil {
			return err
		}
	}
	if e.Type == EventRecorded && e.CategoryState == stateUncategorized && e.Origin != originImport {
		if _, err := s.classify(ctx, e.UserID, []uuid.UUID{e.TransactionID}); err != nil {
			return fmt.Errorf("classify %s: %w", e.TransactionID, err)
		}
	}
	written, err := s.repo.UpsertCategorization(ctx, rec)
	if err != nil || !written || !rec.Corrected {
		return err
	}
	return s.suggest(ctx, rec)
}

// describeCorrection sets the match key and the single category of a corrected transaction.
func (s *Service) describeCorrection(ctx context.Context, rec *Record) error {
	facts, err := s.ledger.TransactionFacts(ctx, rec.UserID, []uuid.UUID{rec.TransactionID})
	if err != nil || len(facts) == 0 {
		return err
	}
	f := facts[0]
	rec.MatchKey = domain.MatchKey(f.PayeeID, f.RawDescription)
	var categories []FactPosting
	for _, p := range f.Postings {
		if p.isCategory() {
			categories = append(categories, p)
		}
	}
	if len(categories) == 1 && !categories[0].isUncategorized() {
		rec.CategoryID = categories[0].AccountID
	}
	return nil
}
