package app

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// MaxCategoryDays bounds the period of CategoryTotals (A77).
const MaxCategoryDays = 366

// CategoryRow is one account of a class with its own booked total in a period.
type CategoryRow struct {
	ID         uuid.UUID
	ParentID   uuid.UUID
	Instrument string
	Closed     bool
	Total      int64
}

// CategoryTotal is a category's own total and the total of its subtree, positive for
// spending of an expense category and earnings of an income category.
type CategoryTotal struct {
	AccountID    uuid.UUID
	Instrument   string
	Total        int64
	SubtreeTotal int64
}

// CategoryTotals totals the categories of class in [from, to] (A77), in the order of the
// repository rows. A closed account is listed only when one of its totals is not zero.
func (s *Service) CategoryTotals(ctx context.Context, userID int64, class string, from, to time.Time) ([]CategoryTotal, error) {
	if days := int(to.Sub(from).Hours()/24) + 1; days < 1 || days > MaxCategoryDays {
		return nil, ErrInvalidCategoryRange
	}
	rows, err := s.repo.CategoryTotals(ctx, userID, class, from, to)
	if err != nil {
		return nil, err
	}
	sign := int64(1)
	if class == "income" {
		sign = -1
	}
	subtree := make(map[uuid.UUID]int64, len(rows))
	parent := make(map[uuid.UUID]uuid.UUID, len(rows))
	for _, r := range rows {
		parent[r.ID] = r.ParentID
	}
	for _, r := range rows {
		for id := r.ID; id != uuid.Nil; id = parent[id] {
			subtree[id] += r.Total * sign
		}
	}
	out := make([]CategoryTotal, 0, len(rows))
	for _, r := range rows {
		t := CategoryTotal{AccountID: r.ID, Instrument: r.Instrument, Total: r.Total * sign, SubtreeTotal: subtree[r.ID]}
		if r.Closed && t.Total == 0 && t.SubtreeTotal == 0 {
			continue
		}
		out = append(out, t)
	}
	return out, nil
}
