package app

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/capture/domain"
)

// MaxSuggestions is the most descriptions one request asks about (ADR 014 L5).
const MaxSuggestions = 40

// noneLasts is how long a kept "no category" answer is served (ADR 014 L4).
const noneLasts = 30 * 24 * time.Hour

// ErrSuggesterUnavailable: no model can answer now; the caller serves what is kept.
var ErrSuggesterUnavailable = errors.New("no language model can answer now")

var ErrTooManySuggestions = errors.New("more than 40 descriptions")

// SuggestItem is a description of an expense or income line without a category.
type SuggestItem struct {
	Description string
	Class       string
}

// CategoryOption is a category a suggestion may name, with its path of names.
type CategoryOption struct {
	ID    uuid.UUID
	Class string
	Path  string
}

// Hint is a kept answer; CategoryID is zero for "none".
type Hint struct {
	Class, Description string
	CategoryID         uuid.UUID
	AnsweredAt         time.Time
}

// Suggestion is the category named for one item; FromModel is true when this request asked
// the model for it.
type Suggestion struct {
	CategoryID uuid.UUID
	FromModel  bool
}

type hintKey struct{ class, description string }

// Suggest names a category for each item from the kept answers, asking the model once for
// the others (ADR 014). available is false when the model could not be asked.
func (s *Service) Suggest(
	ctx context.Context,
	booksID int64,
	items []SuggestItem,
) (out []Suggestion, available bool, err error) {
	if len(items) > MaxSuggestions {
		return nil, false, ErrTooManySuggestions
	}

	out = make([]Suggestion, len(items))

	options, err := s.categoryOptionsOf(ctx, booksID)
	if err != nil {
		return nil, false, err
	}

	keys, descriptions := hintKeys(items)

	kept, err := s.hints.Hints(ctx, booksID, descriptions)
	if err != nil {
		return nil, false, err
	}

	now := s.clock.Now()
	known := knownHints(kept, usableClasses(options), now)
	ask, askKeys := unanswered(items, keys, known, out)

	if len(ask) == 0 {
		return out, true, nil
	}

	if s.suggester == nil || len(options) == 0 {
		return out, s.suggester != nil, nil
	}

	answers, available, err := s.modelAnswers(ctx, booksID, options, ask, askKeys, now)
	if err != nil {
		return nil, false, err
	}

	if !available {
		return out, false, nil
	}

	setModelAnswers(out, keys, answers)

	return out, true, nil
}

func setModelAnswers(out []Suggestion, keys []hintKey, answers map[hintKey]uuid.UUID) {
	for i, k := range keys {
		if id, ok := answers[k]; ok {
			out[i] = Suggestion{CategoryID: id, FromModel: true}
		}
	}
}

func (s *Service) categoryOptionsOf(ctx context.Context, booksID int64) ([]CategoryOption, error) {
	accounts, _, err := s.ledger.Vocabulary(ctx, booksID)
	if err != nil {
		return nil, err
	}

	return categoryOptions(accounts), nil
}

func hintKeys(items []SuggestItem) ([]hintKey, []string) {
	keys := make([]hintKey, len(items))

	var descriptions []string
	for i, it := range items {
		keys[i] = hintKey{it.Class, domain.Normalize(it.Description)}
		descriptions = append(descriptions, keys[i].description)
	}

	return keys, descriptions
}

func usableClasses(options []CategoryOption) map[uuid.UUID]string {
	usable := map[uuid.UUID]string{}
	for _, o := range options {
		usable[o.ID] = o.Class
	}

	return usable
}

// modelAnswers asks the model about ask and keeps its answers; available is false when the
// model could not answer.
func (s *Service) modelAnswers(
	ctx context.Context,
	booksID int64,
	options []CategoryOption,
	ask []SuggestItem,
	askKeys []hintKey,
	now time.Time,
) (map[hintKey]uuid.UUID, bool, error) {
	profile, err := s.profiles.Profile(ctx, booksID)
	if err != nil {
		return nil, false, fmt.Errorf("read profile: %w", err)
	}

	chosen, err := s.suggester.Suggest(ctx, profile, options, ask)
	if errors.Is(err, ErrSuggesterUnavailable) {
		return nil, false, nil
	}

	if err != nil {
		return nil, false, err
	}

	answers, err := s.keepAnswers(ctx, booksID, options, askKeys, chosen, now)
	if err != nil {
		return nil, false, err
	}

	return answers, true, nil
}

func knownHints(kept []Hint, usable map[uuid.UUID]string, now time.Time) map[hintKey]uuid.UUID {
	known := map[hintKey]uuid.UUID{}
	for _, h := range kept {
		k := hintKey{h.Class, h.Description}
		switch {
		case h.CategoryID == uuid.Nil && now.Sub(h.AnsweredAt) < noneLasts:
			known[k] = uuid.Nil
		case h.CategoryID != uuid.Nil && usable[h.CategoryID] == h.Class:
			known[k] = h.CategoryID
		}
	}

	return known
}

// unanswered sets the known answers in out and returns the items the model is asked about.
func unanswered(
	items []SuggestItem,
	keys []hintKey,
	known map[hintKey]uuid.UUID,
	out []Suggestion,
) ([]SuggestItem, []hintKey) {
	var ask []SuggestItem

	var askKeys []hintKey
	for i, k := range keys {
		if id, ok := known[k]; ok {
			out[i].CategoryID = id
			continue
		}

		if k.description == "" || slices.Contains(askKeys, k) {
			continue
		}

		ask = append(
			ask,
			SuggestItem{Description: strings.TrimSpace(items[i].Description), Class: k.class},
		)
		askKeys = append(askKeys, k)
	}

	return ask, askKeys
}

func (s *Service) keepAnswers(
	ctx context.Context,
	booksID int64,
	options []CategoryOption,
	askKeys []hintKey,
	chosen []int,
	now time.Time,
) (map[hintKey]uuid.UUID, error) {
	answers := map[hintKey]uuid.UUID{}
	for j, k := range askKeys {
		var id uuid.UUID
		if n := chosen[j]; n >= 0 && n < len(options) && options[n].Class == k.class {
			id = options[n].ID
		}

		answers[k] = id
		if err := s.hints.SaveHint(
			ctx,
			booksID,
			Hint{Class: k.class, Description: k.description, CategoryID: id, AnsweredAt: now},
		); err != nil {
			return nil, err
		}
	}

	return answers, nil
}

// categoryOptions are the open categories without a system role, named by their path and
// ordered by it.
func categoryOptions(accounts []Account) []CategoryOption {
	byID := map[uuid.UUID]Account{}
	for _, a := range accounts {
		byID[a.ID] = a
	}

	var out []CategoryOption
	for _, a := range accounts {
		if a.Closed || a.SystemRole != "" || (a.Class != "expense" && a.Class != "income") {
			continue
		}

		names := []string{a.Name}
		for p, ok := byID[a.ParentID]; ok && len(names) < 10; p, ok = byID[p.ParentID] {
			names = append([]string{p.Name}, names...)
		}

		out = append(
			out,
			CategoryOption{ID: a.ID, Class: a.Class, Path: strings.Join(names, " › ")},
		)
	}

	slices.SortFunc(out, func(a, b CategoryOption) int {
		return cmp.Or(cmp.Compare(a.Class, b.Class), cmp.Compare(a.Path, b.Path))
	})

	return out
}
