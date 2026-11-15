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
	TakesSavings bool     `json:"takes_savings,omitzero" jsonschema:"also draws the savings; one bucket at most"`
	CategoryIDs  []string `json:"category_ids,omitzero"  jsonschema:"expense categories; subcategories follow"`
}

// planBucketView is a bucket of the plan with its figures of the month (income buckets A230).
type planBucketView struct {
	Name         string     `json:"name"`
	ShareBP      int        `json:"share_bp"`
	TakesSavings bool       `json:"takes_savings,omitzero"`
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
	stored, err := svc.BudgetBuckets(ctx, booksID)
	if err != nil {
		return err
	}

	for _, b := range stored {
		p.storedNames = append(p.storedNames, b.Name)
	}

	return decodeBuckets(in, accounts, p)
}

// decodeBuckets reads the bucket method of a save_buckets call into p; the service checks it.
func decodeBuckets(in []bucketIn, accounts map[uuid.UUID]Account, p *budgetGoalPlan) error {
	for i, b := range in {
		bucket := domain.Bucket{Name: b.Name, ShareBP: b.ShareBP, TakesSavings: b.TakesSavings}
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
	pv.Target = "Income split"
	if len(p.buckets) == 0 {
		pv.Destructive = true
		pv.Changes = []tool.Change{
			{Field: "name", Before: tool.TextValue(strings.Join(p.storedNames, ", "))},
		}

		return
	}

	for i, b := range p.buckets {
		rate := fmt.Sprintf("%d bp of the reference", b.ShareBP)
		if b.TakesSavings {
			rate += " and the savings"
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
}

func categoryNames(ids []uuid.UUID, accounts map[uuid.UUID]Account) []string {
	names := make([]string, len(ids))
	for i, id := range ids {
		names[i] = accountName(accounts, id)
	}

	return names
}

// splitMonth is one month of the income split: the income received and each bucket's target
// on it, its real amount and whether it kept to the target (income buckets A233).
type splitMonth struct {
	Month    string        `json:"month"`
	Received tool.Money    `json:"received"`
	Buckets  []splitBucket `json:"buckets"`
}

type splitBucket struct {
	Name   string     `json:"name"`
	Target tool.Money `json:"target"`
	Real   tool.Money `json:"real"`
	Kept   bool       `json:"kept"`
}

// splitMonths returns the income split of month and the five before; nil without a method.
func splitMonths(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	month time.Time,
) ([]splitMonth, error) {
	h, err := svc.BucketHistory(ctx, booksID, month)
	if err != nil || len(h.Buckets) == 0 {
		return nil, err
	}

	out := make([]splitMonth, len(h.Months))
	for i, m := range h.Months {
		received, err := moneyOf(m.Received, h.Currency)
		if err != nil {
			return nil, err
		}

		out[i] = splitMonth{Month: m.Month.Format(monthLayout), Received: received}

		targets := domain.BucketTargets(m.Received, h.Buckets)
		for j, b := range h.Buckets {
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
