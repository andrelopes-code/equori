package app

import (
	"cmp"
	"context"
	"errors"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/capture/internal/domain"
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

// Suggester names, per item, the index of one option or −1 for none.
type Suggester interface {
	Suggest(ctx context.Context, options []CategoryOption, items []SuggestItem) ([]int, error)
}

// Hint is a kept answer; CategoryID is zero for "none".
type Hint struct {
	Class, Description string
	CategoryID         uuid.UUID
	AnsweredAt         time.Time
}

type HintRepository interface {
	Hints(ctx context.Context, userID int64, descriptions []string) ([]Hint, error)
	SaveHint(ctx context.Context, userID int64, h Hint) error
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
func (s *Service) Suggest(ctx context.Context, userID int64, items []SuggestItem) (out []Suggestion, available bool, err error) {
	if len(items) > MaxSuggestions {
		return nil, false, ErrTooManySuggestions
	}
	out = make([]Suggestion, len(items))
	accounts, _, err := s.ledger.Vocabulary(ctx, userID)
	if err != nil {
		return nil, false, err
	}
	options := categoryOptions(accounts)
	usable := map[uuid.UUID]string{}
	for _, o := range options {
		usable[o.ID] = o.Class
	}
	keys := make([]hintKey, len(items))
	var descriptions []string
	for i, it := range items {
		keys[i] = hintKey{it.Class, domain.Normalize(it.Description)}
		descriptions = append(descriptions, keys[i].description)
	}
	kept, err := s.hints.Hints(ctx, userID, descriptions)
	if err != nil {
		return nil, false, err
	}
	now := s.clock.Now()
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
		ask = append(ask, SuggestItem{Description: strings.TrimSpace(items[i].Description), Class: k.class})
		askKeys = append(askKeys, k)
	}
	if len(ask) == 0 {
		return out, true, nil
	}
	if s.suggester == nil || len(options) == 0 {
		return out, s.suggester != nil, nil
	}
	chosen, err := s.suggester.Suggest(ctx, options, ask)
	if errors.Is(err, ErrSuggesterUnavailable) {
		return out, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	answers := map[hintKey]uuid.UUID{}
	for j, k := range askKeys {
		var id uuid.UUID
		if n := chosen[j]; n >= 0 && n < len(options) && options[n].Class == k.class {
			id = options[n].ID
		}
		answers[k] = id
		if err := s.hints.SaveHint(ctx, userID, Hint{Class: k.class, Description: k.description, CategoryID: id, AnsweredAt: now}); err != nil {
			return nil, false, err
		}
	}
	for i, k := range keys {
		if id, ok := answers[k]; ok {
			out[i] = Suggestion{CategoryID: id, FromModel: true}
		}
	}
	return out, true, nil
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
		out = append(out, CategoryOption{ID: a.ID, Class: a.Class, Path: strings.Join(names, " › ")})
	}
	slices.SortFunc(out, func(a, b CategoryOption) int {
		return cmp.Or(cmp.Compare(a.Class, b.Class), cmp.Compare(a.Path, b.Path))
	})
	return out
}
