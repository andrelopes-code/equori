package domain

import (
	"slices"
	"time"

	"github.com/google/uuid"
)

// historyMonths is the window of the plan's averages: the months before the plan's month.
const historyMonths = 3

// PlanCategory is an expense category as the budget plan reads it.
type PlanCategory struct {
	ID, ParentID uuid.UUID
	Open         bool
}

// PlanInput holds what the rows of a month's plan are derived from. Own holds the own postings
// of each expense category by first day of month, covering at least the history window.
type PlanInput struct {
	Month        time.Time
	Categories   []PlanCategory
	Budgets      []Budget
	Own          map[uuid.UUID]map[time.Time]int64
	FirstPosting time.Time
	HasPostings  bool
}

// PlanRow is one category of a month's plan (budget plan amendment A129). A row without a
// budget has BudgetID uuid.Nil.
type PlanRow struct {
	CategoryID, BudgetID        uuid.UUID
	Planned, LastMonth, Average int64
	Counted                     bool
	NextChange                  time.Time
	HasNextChange               bool
}

// AverageMonths is the number of the three months before month that fall on or after the month
// of the first posting.
func AverageMonths(month, firstPosting time.Time) int {
	first := MonthOf(firstPosting)
	n := 0
	for i := 1; i <= historyMonths; i++ {
		if !MonthOf(month).AddDate(0, -i, 0).Before(first) {
			n++
		}
	}
	return n
}

// Divide divides total by n, rounding half away from zero.
func Divide(total int64, n int) int64 {
	d := int64(n)
	if total < 0 {
		return -((-total*2 + d) / (2 * d))
	}
	return (total*2 + d) / (2 * d)
}

// PlanRows returns the rows of the plan by category ID and the number of months its averages
// divide by. A budgeted row reads its subtree, since a budget covers it; another row reads its
// own postings. A budget is counted when no ancestor has a budget in force in the month.
func PlanRows(in PlanInput) ([]PlanRow, int) {
	month := MonthOf(in.Month)
	n := 0
	if in.HasPostings {
		n = AverageMonths(month, in.FirstPosting)
	}
	parent := make(map[uuid.UUID]uuid.UUID, len(in.Categories))
	children := make(map[uuid.UUID][]uuid.UUID)
	for _, c := range in.Categories {
		parent[c.ID] = c.ParentID
		if c.ParentID != uuid.Nil {
			children[c.ParentID] = append(children[c.ParentID], c.ID)
		}
	}
	budgets := make(map[uuid.UUID]Budget, len(in.Budgets))
	for _, b := range in.Budgets {
		budgets[b.CategoryID] = b
	}
	ancestors := func(id uuid.UUID, has func(uuid.UUID) bool) bool {
		seen := map[uuid.UUID]bool{id: true}
		for p := parent[id]; p != uuid.Nil && !seen[p]; p = parent[p] {
			if has(p) {
				return true
			}
			seen[p] = true
		}
		return false
	}
	var subtree func(id uuid.UUID, m time.Time, seen map[uuid.UUID]bool) int64
	subtree = func(id uuid.UUID, m time.Time, seen map[uuid.UUID]bool) int64 {
		if seen[id] {
			return 0
		}
		seen[id] = true
		total := in.Own[id][m]
		for _, c := range children[id] {
			total += subtree(c, m, seen)
		}
		return total
	}
	history := func(total func(m time.Time) int64) (last, average int64) {
		last = total(month.AddDate(0, -1, 0))
		if n == 0 {
			return last, 0
		}
		var sum int64
		for i := 1; i <= n; i++ {
			sum += total(month.AddDate(0, -i, 0))
		}
		return last, Divide(sum, n)
	}
	var rows []PlanRow
	for _, c := range in.Categories {
		b, budgeted := budgets[c.ID]
		if budgeted {
			planned, _ := b.planned(month)
			row := PlanRow{CategoryID: c.ID, BudgetID: b.ID, Planned: planned}
			row.Counted = !ancestors(c.ID, func(p uuid.UUID) bool {
				pb, ok := budgets[p]
				if !ok {
					return false
				}
				_, inForce := pb.planned(month)
				return inForce
			})
			for _, a := range b.Amounts {
				if a.EffectiveFrom.After(month) {
					row.NextChange, row.HasNextChange = a.EffectiveFrom, true
					break
				}
			}
			row.LastMonth, row.Average = history(func(m time.Time) int64 { return subtree(c.ID, m, map[uuid.UUID]bool{}) })
			rows = append(rows, row)
			continue
		}
		if !c.Open || ancestors(c.ID, func(p uuid.UUID) bool { _, ok := budgets[p]; return ok }) {
			continue
		}
		var spent int64
		for i := 1; i <= historyMonths; i++ {
			spent += in.Own[c.ID][month.AddDate(0, -i, 0)]
		}
		if spent <= 0 {
			continue
		}
		row := PlanRow{CategoryID: c.ID, Counted: true}
		row.LastMonth, row.Average = history(func(m time.Time) int64 { return in.Own[c.ID][m] })
		rows = append(rows, row)
	}
	slices.SortFunc(rows, func(a, b PlanRow) int { return slices.Compare(a.CategoryID[:], b.CategoryID[:]) })
	return rows, n
}
