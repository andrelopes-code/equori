package postgres_test

import (
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
	"github.com/andrelopes-code/equori/internal/portfolio/postgres"
)

// CO1, CO3, CO7, CO8, CO15: every condition field of a plan reads back as stored.
func TestContributionConditionsRoundTrip(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	booksID := pgtest.CreateBooks(t, pool)
	repo := postgres.NewRepository(pool)

	answered := time.Date(2026, 11, 3, 0, 0, 0, 0, time.UTC)
	release := time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC)
	yes := true
	want := domain.Plan{Classes: []domain.PlanClass{{
		Name:            "Stocks",
		TargetBP:        10000,
		Questions:       []string{"Own", "P1"},
		QuestionFacts:   []string{"", "piotroski_p1"},
		QuestionLimits:  []string{"", ""},
		QuestionEffects: []string{domain.EffectHold, domain.EffectWarn},
		QuestionReviews: []int{3, 12},
		Members: []domain.PlanMember{
			{
				Instrument:      money.Currency("BRL"),
				Answers:         []*bool{&yes, &yes},
				AnswerDates:     []*time.Time{&answered, nil},
				AnswerOverrides: []bool{false, true},
				ReleaseMonth:    &release,
			},
		},
	}}}

	revision, err := repo.SaveContributionPlan(ctx, booksID, want)
	if err != nil || revision != 1 {
		t.Fatalf("save: revision %d, err %v", revision, err)
	}

	got, ok, err := repo.ContributionPlan(ctx, booksID)
	if err != nil || !ok {
		t.Fatalf("read: ok %v, err %v", ok, err)
	}

	want.Revision = 1
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("plan read back\n got %+v\nwant %+v", got, want)
	}

	if revision, err = repo.SaveContributionPlan(ctx, booksID, want); err != nil || revision != 2 {
		t.Fatalf("second save: revision %d, err %v", revision, err)
	}
}

// CO15: a save over a plan the writer did not read returns ErrPlanChanged and keeps the plan.
func TestContributionRevisionRejectsStaleSave(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	repo := postgres.NewRepository(pool)

	named := func(name string, expected *int64) domain.Plan {
		return domain.Plan{
			Expected: expected,
			Classes:  []domain.PlanClass{{Name: name, TargetBP: 10000}},
		}
	}
	at := func(n int64) *int64 { return &n }

	tests := []struct {
		name     string
		expected *int64
		revision int64
		changed  bool
	}{
		{name: "nil skips the check", expected: nil, revision: 3},
		{name: "the revision read", expected: at(2), revision: 3},
		{name: "an older revision", expected: at(1), changed: true},
		{name: "a first save over a stored plan", expected: at(0), changed: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			booksID := pgtest.CreateBooks(t, pool)
			for range 2 {
				if _, err := repo.SaveContributionPlan(
					ctx,
					booksID,
					named("Old", nil),
				); err != nil {
					t.Fatal(err)
				}
			}

			revision, err := repo.SaveContributionPlan(ctx, booksID, named("New", tc.expected))
			if errors.Is(err, domain.ErrPlanChanged) != tc.changed || (err != nil) != tc.changed {
				t.Fatalf("err = %v, want changed %v", err, tc.changed)
			}

			if revision != tc.revision {
				t.Fatalf("revision = %d, want %d", revision, tc.revision)
			}

			got, _, err := repo.ContributionPlan(ctx, booksID)
			if err != nil {
				t.Fatal(err)
			}

			wantName := "New"
			if tc.changed {
				wantName = "Old"
			}

			if got.Classes[0].Name != wantName || got.Revision != max(tc.revision, 2) {
				t.Fatalf("stored %q at revision %d", got.Classes[0].Name, got.Revision)
			}
		})
	}
}
