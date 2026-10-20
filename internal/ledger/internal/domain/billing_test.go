package domain

import (
	"errors"
	"testing"
	"time"
)

func rule(from string, closing, due int, assignment string) BillingCycleRule {
	m, err := ParseReferenceMonth(from)
	if err != nil {
		panic(err)
	}
	return BillingCycleRule{EffectiveFrom: m, ClosingDay: closing, DueDay: due, Assignment: assignment, Adjustment: "following", Calendar: "br_banking"}
}

func month(s string) ReferenceMonth {
	m, err := ParseReferenceMonth(s)
	if err != nil {
		panic(err)
	}
	return m
}

func TestReferenceMonth(t *testing.T) {
	m := month("2026-11")
	if m.Add(2).String() != "2027-01" || m.Add(-11).String() != "2025-12" || !m.FirstDay().Equal(day("2026-11-01")) {
		t.Fatalf("arithmetic on %s failed", m)
	}
	if _, err := ParseReferenceMonth("2026-13"); err == nil {
		t.Fatal("month 13 accepted")
	}
}

func TestDatesFor(t *testing.T) {
	tests := []struct {
		rule         BillingCycleRule
		month        string
		closing, due string
	}{
		{rule("2026-01", 3, 10, "next"), "2026-11", "2026-11-03", "2026-11-10"},
		{rule("2026-01", 28, 5, "next"), "2026-11", "2026-10-28", "2026-11-05"},
		{rule("2026-01", 31, 10, "next"), "2026-10", "2026-09-30", "2026-10-10"},
		{rule("2026-01", 31, 15, "next"), "2026-05", "2026-04-30", "2026-05-15"},
		{rule("2026-01", 10, 31, "next"), "2026-02", "2026-02-10", "2026-02-28"},
	}
	for _, tt := range tests {
		got := DatesFor(month(tt.month), tt.rule)
		if got.Closing.Format(time.DateOnly) != tt.closing || got.DueUnadjusted.Format(time.DateOnly) != tt.due {
			t.Errorf("DatesFor(%s, %d/%d) = %s / %s, want %s / %s", tt.month, tt.rule.ClosingDay, tt.rule.DueDay,
				got.Closing.Format(time.DateOnly), got.DueUnadjusted.Format(time.DateOnly), tt.closing, tt.due)
		}
	}
}

func TestStatementFor(t *testing.T) {
	next := Rules{rule("2026-01", 3, 10, "next")}
	closing := Rules{rule("2026-01", 3, 10, "closing")}
	late := Rules{rule("2026-01", 31, 10, "next")}
	lateClosing := Rules{rule("2026-01", 31, 10, "closing")}
	tests := []struct {
		rules    Rules
		purchase string
		want     string
	}{
		{next, "2026-10-14", "2026-11"},
		{next, "2026-11-03", "2026-12"},
		{next, "2026-11-02", "2026-11"},
		{closing, "2026-11-03", "2026-11"},
		{late, "2026-09-30", "2026-11"},
		{lateClosing, "2026-09-30", "2026-10"},
		{Rules{rule("2026-01", 28, 5, "next")}, "2026-10-20", "2026-11"},
	}
	for _, tt := range tests {
		got, err := StatementFor(day(tt.purchase), tt.rules)
		if err != nil || got.String() != tt.want {
			t.Errorf("StatementFor(%s) = %s, %v; want %s", tt.purchase, got, err, tt.want)
		}
	}
}

func TestStatementForRuleChange(t *testing.T) {
	rules := Rules{rule("2026-01", 3, 10, "next"), rule("2026-12", 15, 22, "next")}
	got, err := StatementFor(day("2026-11-10"), rules)
	if err != nil || got.String() != "2026-12" {
		t.Fatalf("StatementFor = %s, %v; want 2026-12", got, err)
	}
	if d := DatesFor(got, mustRule(t, rules, got)); d.Closing.Format(time.DateOnly) != "2026-12-15" {
		t.Fatalf("closing = %s, want 2026-12-15", d.Closing.Format(time.DateOnly))
	}
}

func mustRule(t *testing.T, rules Rules, m ReferenceMonth) BillingCycleRule {
	t.Helper()
	r, err := rules.For(m)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func TestNoBillingRule(t *testing.T) {
	if _, err := StatementFor(day("2025-06-01"), Rules{rule("2026-01", 3, 10, "next")}); !errors.Is(err, ErrNoBillingRule) {
		t.Fatalf("err = %v, want ErrNoBillingRule", err)
	}
	if _, err := (Rules{}).For(month("2026-01")); !errors.Is(err, ErrNoBillingRule) {
		t.Fatalf("empty rules err = %v", err)
	}
}

func TestInstallmentStatement(t *testing.T) {
	if got := InstallmentStatement(month("2026-11"), 3); got.String() != "2027-01" {
		t.Fatalf("k=3: %s", got)
	}
	if got := InstallmentStatement(month("2026-11"), 10); got.String() != "2027-08" {
		t.Fatalf("k=10: %s", got)
	}
}

func TestSplitInstallments(t *testing.T) {
	tests := []struct {
		total int64
		n     int
		want  []int64
	}{
		{100000, 3, []int64{33334, 33333, 33333}},
		{10, 3, []int64{4, 3, 3}},
		{222540, 10, []int64{22254, 22254, 22254, 22254, 22254, 22254, 22254, 22254, 22254, 22254}},
	}
	for _, tt := range tests {
		parts := SplitInstallments(brl(t, tt.total), tt.n)
		var sum int64
		for i, p := range parts {
			sum += p.Amount()
			if p.Amount() != tt.want[i] {
				t.Errorf("split %d/%d part %d = %d, want %d", tt.total, tt.n, i, p.Amount(), tt.want[i])
			}
		}
		if sum != tt.total {
			t.Errorf("split %d/%d sums to %d", tt.total, tt.n, sum)
		}
	}
}

func TestNewBillingCycleRule(t *testing.T) {
	r, err := NewBillingCycleRule(BillingCycleRule{EffectiveFrom: month("2026-11"), ClosingDay: 3, DueDay: 10})
	if err != nil || r.Assignment != AssignNext || r.Adjustment != "following" || r.Calendar != "br_banking" {
		t.Fatalf("defaults = %+v, %v", r, err)
	}
	for field, in := range map[string]BillingCycleRule{
		"closing_day":            {ClosingDay: 0, DueDay: 10},
		"due_day":                {ClosingDay: 3, DueDay: 32},
		"closing_day_assignment": {ClosingDay: 3, DueDay: 10, Assignment: "later"},
		"due_date_adjustment":    {ClosingDay: 3, DueDay: 10, Adjustment: "sideways"},
	} {
		_, err := NewBillingCycleRule(in)
		requireField(t, err, field, ErrValidation)
	}
}

func TestAllocate(t *testing.T) {
	tests := []struct {
		total  int64
		shares []int64
		want   []int64
	}{
		{10000, []int64{18000, 5000}, []int64{7827, 2173}},
		{23000, []int64{18000, 5000}, []int64{18000, 5000}},
		{1, []int64{1, 1, 1}, []int64{1, 0, 0}},
		{100000, []int64{200000, 22540}, []int64{89872, 10128}},
	}
	for _, tt := range tests {
		got := Allocate(tt.total, tt.shares)
		var sum int64
		for i := range got {
			sum += got[i]
			if got[i] != tt.want[i] {
				t.Errorf("Allocate(%d, %v) = %v, want %v", tt.total, tt.shares, got, tt.want)
				break
			}
		}
		if sum != tt.total {
			t.Errorf("Allocate(%d, %v) sums to %d", tt.total, tt.shares, sum)
		}
	}
}

// A87: the closing date counted back from the nominal due date, before any calendar shift.
func TestDatesForBeforeDue(t *testing.T) {
	r := rule("2026-01", 0, 5, "next")
	r.ClosingMode, r.ClosingDaysBeforeDue = ClosingBeforeDue, 7
	for ref, want := range map[string][2]string{
		"2026-09": {"2026-08-29", "2026-09-05"},
		"2026-03": {"2026-02-26", "2026-03-05"},
		"2026-11": {"2026-10-29", "2026-11-05"},
	} {
		d := DatesFor(month(ref), r)
		if d.Closing.Format(time.DateOnly) != want[0] || d.DueUnadjusted.Format(time.DateOnly) != want[1] {
			t.Errorf("%s: closing %s due %s, want %v", ref, d.Closing.Format(time.DateOnly), d.DueUnadjusted.Format(time.DateOnly), want)
		}
	}
}

func TestNewBillingCycleRuleClosingModes(t *testing.T) {
	for name, tc := range map[string]struct {
		r     BillingCycleRule
		field string
	}{
		"day without closing day":    {BillingCycleRule{DueDay: 5}, "closing_day"},
		"before due without days":    {BillingCycleRule{DueDay: 5, ClosingMode: ClosingBeforeDue}, "closing_days_before_due"},
		"before due with 29 days":    {BillingCycleRule{DueDay: 5, ClosingMode: ClosingBeforeDue, ClosingDaysBeforeDue: 29}, "closing_days_before_due"},
		"unknown closing adjustment": {BillingCycleRule{DueDay: 5, ClosingDay: 28, ClosingAdjustment: "sideways"}, "closing_adjustment"},
	} {
		_, err := NewBillingCycleRule(tc.r)
		var fe *FieldError
		if !errors.As(err, &fe) || fe.Field != tc.field {
			t.Errorf("%s: err = %v, want a field error on %s", name, err, tc.field)
		}
	}
}
