package app

import (
	"bytes"
	"cmp"
	"context"
	"slices"
	"time"

	"github.com/google/uuid"
)

// StatementRef is a statement of a card; PreviousClosing is the closing date of the statement
// before it, or a date before any purchase for the first one.
type StatementRef struct {
	ID, CardID                          uuid.UUID
	Reference, Closing, PreviousClosing time.Time
}

type AnalyticsRepository interface {
	StatementCard(ctx context.Context, userID int64, id uuid.UUID) (uuid.UUID, error)
	// CardStatements returns the card's instrument and statements, newest first.
	CardStatements(ctx context.Context, userID int64, cardID uuid.UUID) (string, []StatementRef, error)
	ChargeCategories(ctx context.Context, userID int64) (map[uuid.UUID]bool, error)
}

// StatementParts split what a statement bills; amounts are signed as category postings.
type StatementParts struct {
	Purchases, Installments, Charges, Credits int64
}

func (p StatementParts) Total() int64 { return p.Purchases + p.Installments + p.Charges + p.Credits }

type CategoryParts struct {
	CategoryID uuid.UUID
	StatementParts
}

type StatementAnalytics struct {
	Statement  StatementRef
	Instrument string
	StatementParts
	Categories []CategoryParts
}

// MaxAnalyticsStatements is how many closed statements a card's analytics hold.
const MaxAnalyticsStatements = 12

// StatementAnalytics splits one statement per category (plan 2026-10-26-p9-cash-view,
// section Statement analytics).
func (s *Service) StatementAnalytics(ctx context.Context, userID int64, id uuid.UUID) (StatementAnalytics, error) {
	card, err := s.repo.StatementCard(ctx, userID, id)
	if err != nil {
		return StatementAnalytics{}, err
	}
	instrument, refs, err := s.repo.CardStatements(ctx, userID, card)
	if err != nil {
		return StatementAnalytics{}, err
	}
	i := slices.IndexFunc(refs, func(r StatementRef) bool { return r.ID == id })
	if i < 0 {
		return StatementAnalytics{}, ErrNotFound
	}
	out, err := s.analyse(ctx, userID, instrument, refs[i:i+1])
	if err != nil {
		return StatementAnalytics{}, err
	}
	return out[0], nil
}

// CardStatementAnalytics splits the latest statements of a card closed on or before today,
// oldest first.
func (s *Service) CardStatementAnalytics(ctx context.Context, userID int64, cardID uuid.UUID, today time.Time) ([]StatementAnalytics, error) {
	instrument, refs, err := s.repo.CardStatements(ctx, userID, cardID)
	if err != nil {
		return nil, err
	}
	refs = slices.DeleteFunc(refs, func(r StatementRef) bool { return r.Closing.After(today) })
	refs = refs[:min(len(refs), MaxAnalyticsStatements)]
	slices.Reverse(refs)
	return s.analyse(ctx, userID, instrument, refs)
}

func (s *Service) analyse(ctx context.Context, userID int64, instrument string, refs []StatementRef) ([]StatementAnalytics, error) {
	facts, err := s.repo.CardFacts(ctx, userID, time.Date(9999, 12, 31, 0, 0, 0, 0, time.UTC))
	if err != nil {
		return nil, err
	}
	charges, err := s.repo.ChargeCategories(ctx, userID)
	if err != nil {
		return nil, err
	}
	_, categories := allocate(facts)
	out := make([]StatementAnalytics, len(refs))
	for i, ref := range refs {
		byCategory := map[uuid.UUID]*CategoryParts{}
		for _, l := range facts.Lines {
			if l.CardID != ref.CardID || !l.Statement.Equal(ref.Reference) {
				continue
			}
			for category, v := range categories[l.ID] {
				c := byCategory[category]
				if c == nil {
					c = &CategoryParts{CategoryID: category}
					byCategory[category] = c
				}
				switch {
				case l.Credit:
					c.Credits += v
				case charges[category]:
					c.Charges += v
				case l.Anticipation || l.PlanPurchase != nil && !l.PlanPurchase.After(ref.PreviousClosing):
					c.Installments += v
				default:
					c.Purchases += v
				}
			}
		}
		a := StatementAnalytics{Statement: ref, Instrument: instrument}
		for _, c := range byCategory {
			a.Categories = append(a.Categories, *c)
			a.Purchases += c.Purchases
			a.Installments += c.Installments
			a.Charges += c.Charges
			a.Credits += c.Credits
		}
		slices.SortFunc(a.Categories, func(x, y CategoryParts) int {
			return cmp.Or(cmp.Compare(y.Total(), x.Total()), bytes.Compare(x.CategoryID[:], y.CategoryID[:]))
		})
		out[i] = a
	}
	return out, nil
}
