package toolapi

import (
	"fmt"
	"strings"

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

// previewBuckets lists each bucket with its share and categories.
func previewBuckets(pv *tool.Preview, p budgetGoalPlan) {
	pv.Target = "Income split"
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
