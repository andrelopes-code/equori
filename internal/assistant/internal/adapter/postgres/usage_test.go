package postgres_test

import (
	"reflect"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func TestUsage(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	repo := postgres.NewRepository(pool)
	ctx := t.Context()
	a, b := pgtest.CreateUser(t, pool), pgtest.CreateUser(t, pool)
	today := time.Date(2026, 10, 23, 0, 0, 0, 0, time.UTC)
	until := time.Date(2026, 10, 23, 15, 0, 0, 0, time.UTC)
	entries := []domain.UsageEntry{
		{UserID: a, Day: today, ProviderID: "aistudio", Model: "m", UseID: "capture.suggest", InputTokens: 10, OutputTokens: 5},
		{UserID: a, Day: today, ProviderID: "aistudio", Model: "m", UseID: "capture.suggest", Failed: true, Quota: true, CoolingUntil: until},
		{UserID: a, Day: today, ProviderID: "aistudio", Model: "m", UseID: "assistant.chat", Failed: true},
		{UserID: a, Day: today.AddDate(0, 0, -3), ProviderID: "aistudio", Model: "m", UseID: "assistant.chat", InputTokens: 100},
		{UserID: a, Day: today.AddDate(0, 0, -40), ProviderID: "aistudio", Model: "m", UseID: "assistant.chat", InputTokens: 1000},
		{UserID: b, Day: today, ProviderID: "aistudio", Model: "m", UseID: "assistant.chat", InputTokens: 7},
	}
	for _, e := range entries {
		if err := repo.AddUsage(ctx, e); err != nil {
			t.Fatal(err)
		}
	}
	var requests, errs, quota int
	if err := pool.QueryRow(ctx, `SELECT requests, errors, quota_errors FROM assistant_usage
		WHERE user_id = $1 AND day = $2 AND use_id = 'capture.suggest'`, a, today).Scan(&requests, &errs, &quota); err != nil {
		t.Fatal(err)
	}
	if requests != 2 || errs != 1 || quota != 1 {
		t.Fatalf("counters = %d, %d, %d; want 2, 1, 1", requests, errs, quota)
	}

	got, err := repo.UsageSince(ctx, a, today, today.AddDate(0, 0, -29))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || !got[0].CoolingUntil.Equal(until) {
		t.Fatalf("UsageSince = %+v", got)
	}
	got[0].CoolingUntil = time.Time{}
	want := domain.UsageSummary{ProviderID: "aistudio", Model: "m", TodayRequests: 3, TodayErrors: 2, TodayTokens: 15, PeriodRequests: 4, PeriodTokens: 115}
	if got[0] != want {
		t.Fatalf("summary = %+v\nwant      %+v", got[0], want)
	}
	if quiet, _ := repo.UsageSince(ctx, b, today.AddDate(0, 0, 1), today.AddDate(0, 0, 1)); len(quiet) != 0 {
		t.Fatalf("summary of a day without usage = %+v", quiet)
	}
	if other, _ := repo.UsageSince(ctx, b, today, today); len(other) != 1 || !other[0].CoolingUntil.IsZero() {
		t.Fatalf("other user's summary = %+v", other)
	}
}

func TestLimitsAndProviderDelete(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	repo := postgres.NewRepository(pool)
	ctx := t.Context()
	a := pgtest.CreateUser(t, pool)
	p := provider(t, a, "Local", nil)
	if err := repo.InsertProvider(ctx, p); err != nil {
		t.Fatal(err)
	}
	ten := int64(10)
	limit := domain.Limit{ProviderID: p.ID.String(), Model: "m", RequestsPerDay: &ten}
	if err := repo.SetLimit(ctx, a, limit); err != nil {
		t.Fatal(err)
	}
	if got, err := repo.Limits(ctx, a); err != nil || !reflect.DeepEqual(got, []domain.Limit{limit}) {
		t.Fatalf("Limits = %+v, %v", got, err)
	}
	if err := repo.SetLimit(ctx, a, domain.Limit{ProviderID: p.ID.String(), Model: "m"}); err != nil {
		t.Fatal(err)
	}
	if got, _ := repo.Limits(ctx, a); len(got) != 0 {
		t.Fatalf("cleared limit kept: %+v", got)
	}

	if err := repo.SetLimit(ctx, a, limit); err != nil {
		t.Fatal(err)
	}
	day := time.Date(2026, 10, 23, 0, 0, 0, 0, time.UTC)
	if err := repo.AddUsage(ctx, domain.UsageEntry{UserID: a, Day: day, ProviderID: p.ID.String(), Model: "m", UseID: "assistant.chat"}); err != nil {
		t.Fatal(err)
	}
	if err := repo.DeleteProvider(ctx, a, p.ID); err != nil {
		t.Fatal(err)
	}
	var rows int
	if err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM assistant_usage) + (SELECT count(*) FROM assistant_usage_limit)`).Scan(&rows); err != nil {
		t.Fatal(err)
	}
	if rows != 0 {
		t.Fatalf("%d usage or limit rows kept after the provider was deleted", rows)
	}
}
