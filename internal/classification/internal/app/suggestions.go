package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

const maxExamples = 10

// Suggestion states (P5 amendment A24).
const (
	SuggestionPending   = "pending"
	SuggestionAccepted  = "accepted"
	SuggestionDismissed = "dismissed"
)

var ErrSuggestionClosed = errors.New("the suggestion is already accepted or dismissed")

// Suggestion proposes a rule from repeated manual corrections.
type Suggestion struct {
	ID          uuid.UUID
	UserID      int64
	Fingerprint string
	Conditions  []domain.Condition
	Actions     []domain.Action
	Examples    []uuid.UUID
	State       string
	RuleID      uuid.UUID
	CreatedAt   time.Time
	DecidedAt   *time.Time
}

// SuggestionKey is the cursor of the suggestion list.
type SuggestionKey struct {
	ID uuid.UUID `json:"si"`
}

// suggest proposes a rule when another transaction with rec's match key was corrected to
// the same single category (P5 amendment A24); rec is already stored.
func (s *Service) suggest(ctx context.Context, rec Record) error {
	if rec.CategoryID == uuid.Nil || rec.MatchKey == "" {
		return nil
	}
	examples, err := s.repo.CorrectedExamples(ctx, rec.UserID, rec.MatchKey, rec.CategoryID, maxExamples)
	if err != nil || len(examples) < 2 {
		return err
	}
	conditions, actions := domain.SuggestedRule(rec.MatchKey, rec.CategoryID)
	return s.repo.UpsertSuggestion(ctx, Suggestion{
		UserID: rec.UserID, Fingerprint: domain.Fingerprint(rec.MatchKey, rec.CategoryID),
		Conditions: conditions, Actions: actions, Examples: examples, CreatedAt: rec.DecidedAt,
	})
}

func (s *Service) ListSuggestions(ctx context.Context, userID int64, state string, p page.Request[SuggestionKey]) ([]Suggestion, *SuggestionKey, error) {
	return s.repo.ListSuggestions(ctx, userID, state, p)
}

// AcceptSuggestion creates the suggested rule at the last priority.
func (s *Service) AcceptSuggestion(ctx context.Context, userID int64, id uuid.UUID, name string) (Suggestion, error) {
	var out Suggestion
	err := s.repo.InTx(ctx, func(r Repository) error {
		sg, err := r.LockSuggestion(ctx, userID, id)
		if err != nil {
			return err
		}
		if sg.State != SuggestionPending {
			return ErrSuggestionClosed
		}
		rule, err := s.checkRule(ctx, userID, domain.Rule{Name: name, Enabled: true, Conditions: sg.Conditions, Actions: sg.Actions})
		if err != nil {
			return err
		}
		if rule, err = r.InsertRule(ctx, userID, rule); err != nil {
			return err
		}
		out, err = r.DecideSuggestion(ctx, userID, id, SuggestionAccepted, rule.ID)
		return err
	})
	return out, err
}

func (s *Service) DismissSuggestion(ctx context.Context, userID int64, id uuid.UUID) (Suggestion, error) {
	var out Suggestion
	err := s.repo.InTx(ctx, func(r Repository) error {
		sg, err := r.LockSuggestion(ctx, userID, id)
		if err != nil {
			return err
		}
		if sg.State != SuggestionPending {
			return ErrSuggestionClosed
		}
		out, err = r.DecideSuggestion(ctx, userID, id, SuggestionDismissed, uuid.Nil)
		return err
	})
	return out, err
}
