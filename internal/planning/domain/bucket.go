package domain

import (
	"cmp"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
)

// Bucket bounds (income buckets A229): 10000 basis points are the whole reference.
const (
	maxBuckets       = 10
	maxBucketName    = 40
	bucketWholeShare = 10000
)

// Bucket is a named share of the reference income that its categories, the month's savings when
// TakesSavings and what went into the goals when TakesGoals draw from (income buckets A229,
// A234). AtLeast makes the target a floor instead of a ceiling.
type Bucket struct {
	ID           uuid.UUID
	Name         string
	ShareBP      int
	TakesSavings bool
	TakesGoals   bool
	AtLeast      bool
	Categories   []uuid.UUID
}

// CheckBuckets returns the method with trimmed names, or the first field error of A229. expense
// reports whether an id is an expense category of the book and known whether an id is a bucket
// of the book (A241). An empty method is valid.
func CheckBuckets(
	buckets []Bucket,
	expense func(uuid.UUID) bool,
	known func(uuid.UUID) bool,
) ([]Bucket, error) {
	if len(buckets) > maxBuckets {
		return nil, invalid("buckets", fmt.Sprintf("must hold at most %d buckets", maxBuckets))
	}

	out := slices.Clone(buckets)
	names := make(map[string]bool, len(out))
	placed := make(map[uuid.UUID]bool)
	ids := make(map[uuid.UUID]bool, len(out))
	savings, goals, total := false, false, 0

	for i := range out {
		b := &out[i]
		prefix := fmt.Sprintf("buckets[%d].", i)

		if err := checkBucket(b, prefix, names); err != nil {
			return nil, err
		}

		if b.ID != uuid.Nil && (!known(b.ID) || ids[b.ID]) {
			return nil, invalid(prefix+"id", "must be the id of a bucket of the book, used once")
		}

		ids[b.ID] = true

		if err := checkSingleMeasures(*b, prefix, savings, goals); err != nil {
			return nil, err
		}

		savings = savings || b.TakesSavings
		goals = goals || b.TakesGoals
		total += b.ShareBP

		for _, c := range b.Categories {
			if !expense(c) || placed[c] {
				return nil, invalid(
					prefix+"category_ids",
					"must list expense categories of the book, each in one bucket",
				)
			}

			placed[c] = true
		}
	}

	if len(out) > 0 && total != bucketWholeShare {
		return nil, invalid("buckets", "shares must sum to 10000")
	}

	return out, nil
}

// BucketResolver returns the index of the bucket a category resolves to: the bucket of the
// nearest category, itself or an ancestor, that sits in one (A229). parents maps a category to
// its parent.
func BucketResolver(
	buckets []Bucket,
	parents map[uuid.UUID]uuid.UUID,
) func(uuid.UUID) (int, bool) {
	placed := make(map[uuid.UUID]int)
	for i, b := range buckets {
		for _, c := range b.Categories {
			placed[c] = i
		}
	}

	return func(id uuid.UUID) (int, bool) {
		seen := make(map[uuid.UUID]bool)
		for id != uuid.Nil && !seen[id] {
			if i, ok := placed[id]; ok {
				return i, true
			}

			seen[id] = true
			id = parents[id]
		}

		return 0, false
	}
}

// BucketTargets splits reference over the buckets by share with the largest-remainder method,
// the earlier bucket first on a tie, so the targets sum to reference (A230). A reference at or
// below zero gives zero targets.
func BucketTargets(reference int64, buckets []Bucket) []int64 {
	out := make([]int64, len(buckets))
	if reference <= 0 {
		return out
	}

	rests := make([]int64, len(buckets))

	var assigned int64
	for i, b := range buckets {
		// reference = q×10000 + r keeps the product within int64.
		share := int64(b.ShareBP)
		q, r := reference/bucketWholeShare, reference%bucketWholeShare
		out[i] = q*share + r*share/bucketWholeShare
		rests[i] = r * share % bucketWholeShare
		assigned += out[i]
	}

	order := make([]int, len(buckets))
	for i := range order {
		order[i] = i
	}

	slices.SortStableFunc(order, func(a, b int) int { return cmp.Compare(rests[b], rests[a]) })

	// Shares that sum to the whole leave fewer units than buckets; other shares keep the floors.
	left := reference - assigned
	if left >= int64(len(order)) {
		left = 0
	}

	for _, i := range order[:left] {
		out[i]++
	}

	return out
}

// checkSingleMeasures rejects a second bucket that takes the savings or the goals, and a bucket
// that takes both; savings and goals report whether an earlier bucket takes each.
func checkSingleMeasures(b Bucket, prefix string, savings, goals bool) error {
	if b.TakesSavings && savings {
		return invalid(prefix+"takes_savings", "is set on another bucket")
	}

	if b.TakesGoals && (goals || b.TakesSavings) {
		return invalid(prefix+"takes_goals", "is set on another bucket or with takes_savings")
	}

	return nil
}

// checkBucket trims the name of b and checks it against the names already seen, then its share.
func checkBucket(b *Bucket, prefix string, names map[string]bool) error {
	b.Name = strings.TrimSpace(b.Name)

	key := strings.ToLower(b.Name)
	if b.Name == "" || utf8.RuneCountInString(b.Name) > maxBucketName || names[key] {
		return invalid(prefix+"name", "must be 1 to 40 characters and unique in the method")
	}

	names[key] = true

	if b.ShareBP < 0 || b.ShareBP > bucketWholeShare {
		return invalid(prefix+"share_bp", "must be from 0 to 10000")
	}

	return nil
}

// Verdict holds the figures of a bucket in a month that decide whether it kept its target: the
// real amount, the spending a goal paid, the spending the accumulated balance of rollover budgets
// paid and, for the bucket that takes goals, what was deposited (planning coherence A254).
type Verdict struct{ Real, GoalPaid, Covered, Deposited int64 }

// KeptTarget reports whether a bucket kept to its target in a month (income buckets A233, A234;
// planning coherence A254). The bucket that takes goals kept it when the deposits reach it: a
// goal is built to be spent, so a withdrawal does not miss the floor. The bucket that takes
// savings or one marked AtLeast kept it at or above it. A ceiling bucket kept it when the real
// amount, less what a goal and the accumulated balance paid, is at or below it.
func KeptTarget(b Bucket, v Verdict, target int64) bool {
	switch {
	case b.TakesGoals:
		return v.Deposited >= target
	case b.TakesSavings || b.AtLeast:
		return v.Real >= target
	default:
		return v.Real-v.GoalPaid-v.Covered <= target
	}
}
