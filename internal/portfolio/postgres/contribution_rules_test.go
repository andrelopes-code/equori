package postgres_test

import (
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
	"github.com/andrelopes-code/equori/internal/portfolio/postgres"
)

func TestContributionRulesRoundTrip(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	booksID := pgtest.CreateBooks(t, pool)
	repo := postgres.NewRepository(pool)

	from, to, daily := 2031, 2035, false
	want := domain.Plan{Classes: []domain.PlanClass{
		{
			Name:     "Fixed income",
			TargetBP: 6000,
			Rules: []domain.PlanRule{
				{
					InstrumentType: "fixed_income",
					Subtypes:       []string{"cdb", "lci"},
					ReturnKind:     domain.ReturnRate,
				},
				{
					MaturesFromYear: &from,
					MaturesToYear:   &to,
					DailyLiquidity:  &daily,
					Guarantee:       domain.GuaranteeCovered,
					QuoteCurrency:   money.Currency("BRL"),
				},
			},
		},
		{
			Name:     "Stocks",
			TargetBP: 4000,
			Members:  []domain.PlanMember{{Instrument: money.Currency("BRL")}},
		},
	}}

	if err := repo.SaveContributionPlan(ctx, booksID, want); err != nil {
		t.Fatalf("save: %v", err)
	}

	got, ok, err := repo.ContributionPlan(ctx, booksID)
	if err != nil || !ok {
		t.Fatalf("read: ok %v, err %v", ok, err)
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("plan read back\n got %+v\nwant %+v", got, want)
	}
}
