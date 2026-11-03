package app

import (
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestDetectSeries(t *testing.T) {
	t.Parallel()

	var (
		acc1, acc2 = uuid.MustParse("00000000-0000-0000-0000-0000000000a1"), uuid.MustParse("00000000-0000-0000-0000-0000000000a2")
		cat1, cat2 = uuid.MustParse("00000000-0000-0000-0000-0000000000c1"), uuid.MustParse("00000000-0000-0000-0000-0000000000c2")
	)

	tests := []struct {
		name  string
		facts []SeriesFact
		want  []Series
	}{
		{
			"three_monthly",
			facts(acc1, cat1, "netflix", 5000, "2026-08-10", "2026-09-10", "2026-10-10"),
			[]Series{{
				Key: "netflix", AccountID: acc1, CategoryID: cat1, Frequency: CadenceMonthly, Count: 3,
				LastDate: day("2026-10-10"), NextDate: day("2026-11-10"), LastAmount: 5000,
			}},
		},
		{
			"two_monthly",
			facts(acc1, cat1, "netflix", 5000, "2026-09-10", "2026-10-10"),
			[]Series{{
				Key: "netflix", AccountID: acc1, CategoryID: cat1, Frequency: CadenceMonthly, Count: 2,
				LastDate: day("2026-10-10"), NextDate: day("2026-11-10"), LastAmount: 5000,
			}},
		},
		{"two_weekly", facts(acc1, cat1, "gym", 5000, "2026-10-03", "2026-10-10"), nil},
		{
			"three_weekly",
			facts(acc1, cat1, "gym", 5000, "2026-09-26", "2026-10-03", "2026-10-10"),
			[]Series{{
				Key: "gym", AccountID: acc1, CategoryID: cat1, Frequency: CadenceWeekly, Count: 3,
				LastDate: day("2026-10-10"), NextDate: day("2026-10-17"), LastAmount: 5000,
			}},
		},
		{
			"two_yearly",
			facts(acc1, cat1, "domain", 9000, "2025-10-10", "2026-10-10"),
			[]Series{{
				Key: "domain", AccountID: acc1, CategoryID: cat1, Frequency: CadenceYearly, Count: 2,
				LastDate: day("2026-10-10"), NextDate: day("2027-10-10"), LastAmount: 9000,
			}},
		},
		{"two_quarterly", facts(acc1, cat1, "insurance", 9000, "2026-04-10", "2026-07-10"), nil},
		{
			"three_quarterly",
			facts(acc1, cat1, "insurance", 9000, "2026-01-10", "2026-04-10", "2026-07-10"),
			[]Series{{
				Key: "insurance", AccountID: acc1, CategoryID: cat1, Frequency: CadenceQuarterly, Count: 3,
				LastDate: day("2026-07-10"), NextDate: day("2026-10-10"), LastAmount: 9000,
			}},
		},
		{
			"monthly_raise_20",
			slices.Concat(
				facts(acc1, cat1, "netflix", 5000, "2026-08-10", "2026-09-10"),
				facts(acc1, cat1, "netflix", 6000, "2026-10-10"),
			),
			[]Series{{
				Key: "netflix", AccountID: acc1, CategoryID: cat1, Frequency: CadenceMonthly, Count: 3,
				LastDate: day("2026-10-10"), NextDate: day("2026-11-10"), LastAmount: 6000,
			}},
		},
		{
			"monthly_raise_30",
			slices.Concat(
				facts(acc1, cat1, "netflix", 5000, "2026-08-10", "2026-09-10"),
				facts(acc1, cat1, "netflix", 6500, "2026-10-10"),
			),
			nil,
		},
		{
			"one_gap_of_four_intervals",
			facts(acc1, cat1, "netflix", 5000, "2026-06-10", "2026-07-10", "2026-09-08", "2026-10-08", "2026-11-07"),
			[]Series{{
				Key: "netflix", AccountID: acc1, CategoryID: cat1, Frequency: CadenceMonthly, Count: 5,
				LastDate: day("2026-11-07"), NextDate: day("2026-12-07"), LastAmount: 5000,
			}},
		},
		{
			"one_gap_of_three_intervals",
			facts(acc1, cat1, "netflix", 5000, "2026-07-10", "2026-09-08", "2026-10-08", "2026-11-07"),
			nil,
		},
		{"median_outside_bands", facts(acc1, cat1, "tax", 5000, "2026-01-10", "2026-02-24", "2026-04-10"), nil},
		{
			"different_accounts_same_key",
			slices.Concat(
				facts(acc1, cat1, "netflix", 5000, "2026-09-10", "2026-10-10"),
				facts(acc2, cat1, "netflix", 5000, "2026-09-12", "2026-10-12"),
			),
			[]Series{
				{
					Key: "netflix", AccountID: acc2, CategoryID: cat1, Frequency: CadenceMonthly, Count: 2,
					LastDate: day("2026-10-12"), NextDate: day("2026-11-12"), LastAmount: 5000,
				},
				{
					Key: "netflix", AccountID: acc1, CategoryID: cat1, Frequency: CadenceMonthly, Count: 2,
					LastDate: day("2026-10-10"), NextDate: day("2026-11-10"), LastAmount: 5000,
				},
			},
		},
		{
			"category_most_frequent",
			slices.Concat(
				facts(acc1, cat1, "netflix", 5000, "2026-07-10"),
				facts(acc1, cat2, "netflix", 5000, "2026-08-10", "2026-09-10"),
				facts(acc1, cat1, "netflix", 5000, "2026-10-10"),
				facts(acc1, cat2, "netflix", 5000, "2026-11-10"),
			),
			[]Series{{
				Key: "netflix", AccountID: acc1, CategoryID: cat2, Frequency: CadenceMonthly, Count: 5,
				LastDate: day("2026-11-10"), NextDate: day("2026-12-10"), LastAmount: 5000,
			}},
		},
		{
			"category_tie_goes_to_most_recent",
			slices.Concat(
				facts(acc1, cat1, "netflix", 5000, "2026-08-10", "2026-09-10"),
				facts(acc1, cat2, "netflix", 5000, "2026-10-10", "2026-11-10"),
			),
			[]Series{{
				Key: "netflix", AccountID: acc1, CategoryID: cat2, Frequency: CadenceMonthly, Count: 4,
				LastDate: day("2026-11-10"), NextDate: day("2026-12-10"), LastAmount: 5000,
			}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := DetectSeries(tt.facts)
			for i := range got {
				got[i].TransactionIDs = nil
			}

			if !slices.EqualFunc(got, tt.want, sameSeries) {
				t.Errorf("DetectSeries = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestDetectSeriesKeepsSixMostRecentTransactions(t *testing.T) {
	t.Parallel()

	fs := facts(uuid.New(), uuid.New(), "netflix", 5000,
		"2026-01-10", "2026-02-10", "2026-03-10", "2026-04-10", "2026-05-10", "2026-06-10", "2026-07-10")

	got := DetectSeries(fs)
	if len(got) != 1 {
		t.Fatalf("series = %d, want 1", len(got))
	}

	var want []uuid.UUID
	for i := len(fs) - 1; i >= len(fs)-6; i-- {
		want = append(want, fs[i].TransactionID)
	}

	if !slices.Equal(got[0].TransactionIDs, want) {
		t.Errorf("TransactionIDs = %v, want %v", got[0].TransactionIDs, want)
	}
}

// facts returns one fact per date, in the order given, with fresh transaction IDs.
func facts(account, category uuid.UUID, key string, amount int64, dates ...string) []SeriesFact {
	out := make([]SeriesFact, len(dates))
	for i, d := range dates {
		out[i] = SeriesFact{
			TransactionID: uuid.New(), AccountID: account, CategoryID: category,
			Key: key, Date: day(d), Amount: amount,
		}
	}

	return out
}

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}

func sameSeries(a, b Series) bool {
	return a.Key == b.Key && a.AccountID == b.AccountID && a.CategoryID == b.CategoryID &&
		a.PayeeID == b.PayeeID && a.Frequency == b.Frequency && a.Count == b.Count &&
		a.LastDate.Equal(b.LastDate) && a.NextDate.Equal(b.NextDate) && a.LastAmount == b.LastAmount &&
		a.ScheduleID == b.ScheduleID
}
