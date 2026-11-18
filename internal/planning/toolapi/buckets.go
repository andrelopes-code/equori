package toolapi

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type bucketIn struct {
	Name         string   `json:"name"                   jsonschema:"unique bucket name"`
	ShareBP      int      `json:"share_bp"               jsonschema:"basis points; shares sum to 10000"`
	TakesSavings bool     `json:"takes_savings,omitzero" jsonschema:"also draws the savings; one at most"`
	TakesGoals   bool     `json:"takes_goals,omitzero"   jsonschema:"also draws goal deposits"`
	AtLeast      bool     `json:"at_least,omitzero"      jsonschema:"target is a floor"`
	CategoryIDs  []string `json:"category_ids,omitzero"  jsonschema:"expense categories; subcategories follow"`
}

// planBucketView is a bucket of the plan with its figures of the month (income buckets A230).
type planBucketView struct {
	Name         string     `json:"name"`
	ShareBP      int        `json:"share_bp"`
	TakesSavings bool       `json:"takes_savings,omitzero"`
	TakesGoals   bool       `json:"takes_goals,omitzero"`
	AtLeast      bool       `json:"at_least,omitzero"`
	Categories   []string   `json:"categories"`
	Target       tool.Money `json:"target,omitzero"`
	Planned      tool.Money `json:"planned"`
	Spent        tool.Money `json:"spent"`
}

// planBucketViews returns the bucket method of the plan; nil without one.
func planBucketViews(p app.Plan, accounts map[uuid.UUID]Account) ([]planBucketView, error) {
	targets, hasTargets := p.BucketTargets()
	out := make([]planBucketView, 0, len(p.Buckets))

	for i, b := range p.Buckets {
		v := planBucketView{
			Name:         b.Name,
			ShareBP:      b.ShareBP,
			TakesSavings: b.TakesSavings,
			TakesGoals:   b.TakesGoals,
			AtLeast:      b.AtLeast,
			Categories:   categoryNames(b.Categories, accounts),
		}

		var err error
		if v.Planned, err = moneyOf(b.Planned, p.Currency); err != nil {
			return nil, err
		}

		if v.Spent, err = moneyOf(b.Spent, p.Currency); err != nil {
			return nil, err
		}

		if hasTargets {
			if v.Target, err = moneyOf(targets[i], p.Currency); err != nil {
				return nil, err
			}
		}

		out = append(out, v)
	}

	if len(out) == 0 {
		return nil, nil
	}

	return out, nil
}

// loadBuckets reads the stored bucket names and the method of a save_buckets call into p.
func loadBuckets(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in []bucketIn,
	accounts map[uuid.UUID]Account,
	p *budgetGoalPlan,
) error {
	var month *time.Time
	if !p.month.IsZero() {
		month = &p.month
	}

	stored, err := svc.BudgetBuckets(ctx, booksID, month)
	if err != nil {
		return err
	}

	for _, b := range stored.Buckets {
		p.storedNames = append(p.storedNames, b.Name)
	}

	if err := decodeBuckets(in, accounts, p); err != nil {
		return err
	}

	continueBuckets(p.buckets, stored.Buckets)

	return loadOutsideNames(ctx, svc, booksID, accounts, p)
}

// continueBuckets gives each bucket the id of the stored bucket with the same name, ignoring
// case and surrounding spaces; the tool continues a bucket by its name.
func continueBuckets(buckets, stored []domain.Bucket) {
	byName := make(map[string]uuid.UUID, len(stored))
	for _, b := range stored {
		byName[strings.ToLower(strings.TrimSpace(b.Name))] = b.ID
	}

	for i := range buckets {
		buckets[i].ID = byName[strings.ToLower(strings.TrimSpace(buckets[i].Name))]
	}
}

// decodeBuckets reads the bucket method of a save_buckets call into p; the service checks it.
func decodeBuckets(in []bucketIn, accounts map[uuid.UUID]Account, p *budgetGoalPlan) error {
	for i, b := range in {
		bucket := domain.Bucket{
			Name:         b.Name,
			ShareBP:      b.ShareBP,
			TakesSavings: b.TakesSavings,
			TakesGoals:   b.TakesGoals,
			AtLeast:      b.AtLeast,
		}
		for _, s := range b.CategoryIDs {
			id, err := optionalID(s, fmt.Sprintf("buckets[%d].category_ids", i))
			if err != nil {
				return err
			}

			bucket.Categories = append(bucket.Categories, id)
		}

		p.buckets = append(p.buckets, bucket)
		p.bucketNames = append(p.bucketNames, categoryNames(bucket.Categories, accounts))
	}

	return nil
}

// previewBuckets lists each bucket with its share and categories, or the buckets an empty
// list removes.
func previewBuckets(pv *tool.Preview, p budgetGoalPlan) {
	if len(p.buckets) == 0 {
		pv.Destructive = true
		pv.Changes = []tool.Change{
			{Field: "name", Before: tool.TextValue(strings.Join(p.storedNames, ", "))},
		}

		return
	}

	if !p.month.IsZero() {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "date", After: tool.DateValue(p.month)},
		)
	}

	for i, b := range p.buckets {
		rate := fmt.Sprintf("%d bp of the reference", b.ShareBP)
		if b.TakesSavings {
			rate += " and the savings"
		}

		if b.TakesGoals {
			rate += " and what went into the goals"
		}

		if b.AtLeast {
			rate += ", at least"
		}

		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "name", After: tool.TextValue(b.Name)},
			tool.Change{Field: "rate", After: tool.TextValue(rate)},
		)
		if len(p.bucketNames[i]) > 0 {
			pv.Changes = append(pv.Changes, tool.Change{
				Field: "category",
				After: tool.TextValue(strings.Join(p.bucketNames[i], ", ")),
			})
		}
	}

	if len(p.outsideNames) > 0 {
		pv.Changes = append(pv.Changes, tool.Change{
			Field: "category",
			After: tool.TextValue("Outside the split: " + strings.Join(p.outsideNames, ", ")),
		})
	}
}

// previewMove shows the bucket of the category before and after the move and how many
// categories the move leaves outside the split (A237).
func previewMove(pv *tool.Preview, p budgetGoalPlan) {
	outside := fmt.Sprintf("%d categories outside the split", p.move.Outside)
	if p.move.Outside == 1 {
		outside = "1 category outside the split"
	}

	pv.Target = p.categoryName
	pv.Changes = []tool.Change{
		{
			Field:  "name",
			Before: tool.TextValue(p.move.Before),
			After:  tool.TextValue(p.move.After),
		},
		{Field: "count", After: tool.TextValue(outside)},
	}
}

func categoryNames(ids []uuid.UUID, accounts map[uuid.UUID]Account) []string {
	names := make([]string, len(ids))
	for i, id := range ids {
		names[i] = accountName(accounts, id)
	}

	return names
}

// splitMonth is one month of the income split: the income received and each bucket's target
// on it, its real amount and whether it kept to the target (income buckets A233). Unallocated
// is the income that no bucket and no spending took (A235). Retained is the yield that stayed in
// the investments, outside Received; absent at zero (planning coherence A252).
type splitMonth struct {
	Month       string        `json:"month"`
	From        string        `json:"from,omitzero"`
	Received    tool.Money    `json:"received"`
	Unallocated tool.Money    `json:"unallocated"`
	Retained    tool.Money    `json:"retained,omitzero"`
	Buckets     []splitBucket `json:"buckets"`
}

type splitBucket struct {
	Name   string     `json:"name"`
	Target tool.Money `json:"target"`
	Real   tool.Money `json:"real"`
	Kept   bool       `json:"kept"`
}

// splitMonths returns the income split of month and the five before, each month read through the
// method in force in it; nil when no month of the window has a method.
func splitMonths(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	month time.Time,
) ([]splitMonth, error) {
	h, err := svc.BucketHistory(ctx, booksID, month)
	if err != nil || len(h.Methods) == 0 {
		return nil, err
	}

	out := make([]splitMonth, len(h.Months))
	for i, m := range h.Months {
		received, err := moneyOf(m.Received, h.Currency)
		if err != nil {
			return nil, err
		}

		rest, err := moneyOf(m.Unallocated, h.Currency)
		if err != nil {
			return nil, err
		}

		out[i] = splitMonth{
			Month:       m.Month.Format(monthLayout),
			Received:    received,
			Unallocated: rest,
		}
		if m.HasMethod {
			out[i].From = m.From.Format(monthLayout)
		}

		if m.Retained != 0 {
			if out[i].Retained, err = moneyOf(m.Retained, h.Currency); err != nil {
				return nil, err
			}
		}

		buckets := methodBuckets(h.Methods, m.From)
		targets := domain.BucketTargets(m.Received, buckets)

		for j, b := range buckets {
			v := splitBucket{Name: b.Name, Kept: domain.KeptTarget(b, m.Real[j], targets[j])}
			if v.Target, err = moneyOf(targets[j], h.Currency); err != nil {
				return nil, err
			}

			if v.Real, err = moneyOf(m.Real[j], h.Currency); err != nil {
				return nil, err
			}

			out[i].Buckets = append(out[i].Buckets, v)
		}
	}

	return out, nil
}

// methodBuckets returns the buckets of the method that starts at from; none for a zero from.
func methodBuckets(methods []domain.Method, from time.Time) []domain.Bucket {
	for _, m := range methods {
		if m.From.Equal(from) {
			return m.Buckets
		}
	}

	return nil
}

// bucketVersionView is a version of the bucket method: its start month and each bucket's share.
type bucketVersionView struct {
	From    string `json:"from"`
	Buckets []struct {
		Name    string `json:"name"`
		ShareBP int    `json:"share_bp"`
	} `json:"buckets"`
}

// bucketVersionViews returns every version of the bucket method by start month; nil without one.
func bucketVersionViews(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
) ([]bucketVersionView, error) {
	versions, err := svc.BucketVersions(ctx, booksID)
	if err != nil {
		return nil, err
	}

	var out []bucketVersionView

	for _, v := range versions {
		view := bucketVersionView{From: v.From.Format(monthLayout)}
		for _, b := range v.Buckets {
			view.Buckets = append(view.Buckets, struct {
				Name    string `json:"name"`
				ShareBP int    `json:"share_bp"`
			}{b.Name, b.ShareBP})
		}

		out = append(out, view)
	}

	return out, nil
}
