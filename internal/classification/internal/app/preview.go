package app

import (
	"context"
	"slices"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
)

const (
	previewDays   = 365
	previewSample = 50
)

// PreviewSet counts the transactions of one outcome and lists the newest of them.
type PreviewSet struct {
	Count          int
	TransactionIDs []uuid.UUID
}

func (p *PreviewSet) add(id uuid.UUID) {
	p.Count++
	if len(p.TransactionIDs) < previewSample {
		p.TransactionIDs = append(p.TransactionIDs, id)
	}
}

// RulePreview is what a rule would do alone over the last year (A81).
type RulePreview struct {
	WouldCategorize PreviewSet
	Conflicts       PreviewSet
}

// PreviewRule evaluates r, validated as CreateRule validates it, without the other rules over
// the non-voided transactions dated in [today - 365 days, today]. Nothing is written.
func (s *Service) PreviewRule(ctx context.Context, userID int64, r domain.Rule) (RulePreview, error) {
	r, err := s.checkRule(ctx, userID, r)
	if err != nil {
		return RulePreview{}, err
	}
	c, accounts, err := s.catalog(ctx, userID)
	if err != nil {
		return RulePreview{}, err
	}
	c.Rules = []domain.Rule{r}
	today := s.ledger.Today()
	var out RulePreview
	var after *PendingKey
	for {
		ids, next, err := s.repo.PreviewCandidates(ctx, userID, today.AddDate(0, 0, -previewDays), today, after, runPage)
		if err != nil {
			return RulePreview{}, err
		}
		facts, err := s.ledger.TransactionFacts(ctx, userID, ids)
		if err != nil {
			return RulePreview{}, err
		}
		byID := make(map[uuid.UUID]TransactionFacts, len(facts))
		for _, f := range facts {
			byID[f.ID] = f
		}
		for _, id := range ids {
			f, ok := byID[id]
			if !ok || f.Voided {
				continue
			}
			d := domain.Decide(subjectOf(f, accounts), c)
			if d.Method != domain.MethodRule {
				continue
			}
			switch {
			case f.CategoryState == stateUncategorized:
				out.WouldCategorize.add(id)
			case d.TransferTo != uuid.Nil || !sameAllocation(d.Parts, f.Postings):
				out.Conflicts.add(id)
			}
		}
		if next == nil {
			return out, nil
		}
		after = next
	}
}

// sameAllocation compares the decided parts with the category postings as multisets of
// category and amount.
func sameAllocation(parts []domain.Allocation, postings []FactPosting) bool {
	var decided, current []string
	for _, p := range parts {
		decided = append(decided, p.CategoryID.String()+" "+p.Amount.String())
	}
	for _, p := range postings {
		if p.isCategory() {
			current = append(current, p.AccountID.String()+" "+p.Amount.String())
		}
	}
	slices.Sort(decided)
	slices.Sort(current)
	return strings.Join(decided, ",") == strings.Join(current, ",")
}
