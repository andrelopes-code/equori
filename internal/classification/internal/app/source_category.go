package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// SourceCategory is a category an aggregator assigned to lines, with the number of lines
// that carried it and the owner's category for it (P6 amendment A41).
type SourceCategory struct {
	ID                           uuid.UUID
	Aggregator, ExternalID, Name string
	Count                        int
	CategoryID                   uuid.UUID // zero while unmapped
}

// LineCategory is the aggregator category of an imported line.
type LineCategory struct {
	Aggregator, ExternalID, Name string
}

// NameKey pages lists ordered by name.
type NameKey struct {
	Name string    `json:"n"`
	ID   uuid.UUID `json:"i"`
}

func (s *Service) ListSourceCategories(ctx context.Context, userID int64, p page.Request[NameKey]) ([]SourceCategory, *NameKey, error) {
	return s.repo.ListSourceCategories(ctx, userID, p)
}

// MapSourceCategory sets the category that lines carrying the source category get when no
// rule decides them; uuid.Nil clears it.
func (s *Service) MapSourceCategory(ctx context.Context, userID int64, id, categoryID uuid.UUID) (SourceCategory, error) {
	if categoryID != uuid.Nil {
		accounts, err := s.accounts(ctx, userID)
		if err != nil {
			return SourceCategory{}, err
		}
		if a, ok := accounts[categoryID]; !ok || !a.isCategory() || a.isUncategorized() {
			return SourceCategory{}, &domain.FieldError{Field: "category_id", Message: "must be an income or expense category", Err: domain.ErrValidation}
		}
	}
	return s.repo.MapSourceCategory(ctx, userID, id, categoryID)
}

// sourceCategories counts the categories the lines carry and returns, per line, the
// owner's category for it.
func (s *Service) sourceCategories(ctx context.Context, userID int64, lines []ImportLine) ([]uuid.UUID, error) {
	out := make([]uuid.UUID, len(lines))
	seen := map[LineCategory]int{}
	byAggregator := map[string][]string{}
	var order []LineCategory
	for _, l := range lines {
		c := l.SourceCategory
		if c == nil {
			continue
		}
		key := LineCategory{Aggregator: c.Aggregator, ExternalID: c.ExternalID}
		if seen[key] == 0 {
			order = append(order, key)
			byAggregator[c.Aggregator] = append(byAggregator[c.Aggregator], c.ExternalID)
		}
		seen[key]++
	}
	if len(order) == 0 {
		return out, nil
	}
	names := map[LineCategory]string{}
	for _, l := range lines {
		if c := l.SourceCategory; c != nil && c.Name != "" {
			names[LineCategory{Aggregator: c.Aggregator, ExternalID: c.ExternalID}] = c.Name
		}
	}
	counts := make([]SourceCategory, len(order))
	for i, k := range order {
		counts[i] = SourceCategory{Aggregator: k.Aggregator, ExternalID: k.ExternalID, Name: names[k], Count: seen[k]}
	}
	if err := s.repo.CountSourceCategories(ctx, userID, counts); err != nil {
		return nil, err
	}
	mapped := map[LineCategory]uuid.UUID{}
	for aggregator, ids := range byAggregator {
		m, err := s.repo.MappedSourceCategories(ctx, userID, aggregator, ids)
		if err != nil {
			return nil, err
		}
		for id, category := range m {
			mapped[LineCategory{Aggregator: aggregator, ExternalID: id}] = category
		}
	}
	for i, l := range lines {
		if c := l.SourceCategory; c != nil {
			out[i] = mapped[LineCategory{Aggregator: c.Aggregator, ExternalID: c.ExternalID}]
		}
	}
	return out, nil
}
