package domain

import (
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestSplit(t *testing.T) {
	t.Parallel()

	cn14 := []int64{1000000, 300000, 100000, 400000}

	tests := []struct {
		name    string
		targets []int
		values  []int64
		amount  int64
		want    []int64
	}{
		{"CN14 1500", []int{4000, 2000, 2000, 2000}, cn14, 150000, []int64{0, 0, 150000, 0}},
		{"CN14 4000", []int{4000, 2000, 2000, 2000}, cn14, 400000, []int64{0, 100000, 300000, 0}},
		{
			"empty portfolio",
			[]int{5000, 3000, 2000},
			[]int64{0, 0, 0},
			1000,
			[]int64{500, 300, 200},
		},
		{"largest remainder", []int{3334, 3333, 3333}, []int64{0, 0, 0}, 100, []int64{34, 33, 33}},
		{"zero target", []int{0, 10000}, []int64{0, 0}, 50, []int64{0, 50}},
		{"overweight class", []int{5000, 5000}, []int64{900, 100}, 100, []int64{0, 100}},
		{"zero amount", []int{5000, 5000}, []int64{10, 0}, 0, []int64{0, 0}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := Split(slots(tt.targets, tt.values), tt.amount)

			if !slices.Equal(got, tt.want) {
				t.Fatalf("Split = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDrift(t *testing.T) {
	t.Parallel()

	targets := []int{4000, 2000, 2000, 2000}

	tests := []struct {
		name   string
		values []int64
		wantBP int
		wantOK bool
	}{
		{"CN14", []int64{1000000, 300000, 100000, 400000}, 1777, true},
		{"after the 4000 split", []int64{1000000, 400000, 400000, 400000}, 545, true},
		{"nothing held", []int64{0, 0, 0, 0}, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			gotBP, gotOK := Drift(slots(targets, tt.values))

			if gotBP != tt.wantBP || gotOK != tt.wantOK {
				t.Fatalf("Drift = %d, %t, want %d, %t", gotBP, gotOK, tt.wantBP, tt.wantOK)
			}
		})
	}
}

func TestPlanCheck(t *testing.T) {
	t.Parallel()

	acc := uuid.New()
	inst := money.Currency("HGLG11")

	tests := []struct {
		name string
		plan Plan
		want error
	}{
		{"valid plan", validPlan(), nil},
		{"class targets 6000+3000", planOf(class("A", 6000), class("B", 3000)), ErrTargetSum},
		{
			"names differ by case",
			planOf(class("FII", 5000), class("fii", 5000)),
			ErrClassNameDuplicate,
		},
		{
			"one member without target",
			planOf(
				withMembers(
					class("A", 10000),
					member(acc, "", ptr(10000)),
					member(uuid.New(), "", nil),
				),
			),
			ErrMemberTargetSum,
		},
		{
			"member targets 5000+4000",
			planOf(
				withMembers(
					class("A", 10000),
					member(acc, "", ptr(5000)),
					member(uuid.New(), "", ptr(4000)),
				),
			),
			ErrMemberTargetSum,
		},
		{
			"instrument in two classes",
			planOf(
				withMembers(class("A", 5000), member(uuid.Nil, inst, nil)),
				withMembers(class("B", 5000), member(uuid.Nil, inst, nil)),
			),
			ErrMemberDuplicate,
		},
		{
			"account twice",
			planOf(withMembers(class("A", 10000), member(acc, "", nil), member(acc, "", nil))),
			ErrMemberDuplicate,
		},
		{
			"member with both fields",
			planOf(withMembers(class("A", 10000), member(acc, inst, nil))),
			ErrPlanInvalid,
		},
		{
			"member with neither field",
			planOf(withMembers(class("A", 10000), member(uuid.Nil, "", nil))),
			ErrPlanInvalid,
		},
		{"21 classes", manyClasses(21), ErrPlanInvalid},
		{"20 classes", manyClasses(20), nil},
		{"empty name", planOf(class("", 10000)), ErrPlanInvalid},
		{"name of 61 characters", planOf(class(strings.Repeat("a", 61), 10000)), ErrPlanInvalid},
		{"target above 10000", planOf(class("A", 10001)), ErrPlanInvalid},
		{"negative target", planOf(class("A", -1), class("B", 10001)), ErrPlanInvalid},
		{"amount 0", withAmount(validPlan(), 0), ErrPlanInvalid},
		{"amount 1", withAmount(validPlan(), 1), nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := tt.plan.Check()

			if !errors.Is(got, tt.want) {
				t.Fatalf("Check = %v, want %v", got, tt.want)
			}
		})
	}
}

func slots(targets []int, values []int64) []Slot {
	out := make([]Slot, len(targets))
	for i := range targets {
		out[i] = Slot{TargetBP: targets[i], Value: values[i]}
	}

	return out
}

func validPlan() Plan {
	return planOf(
		withMembers(
			class("Stocks", 6000),
			member(uuid.New(), "", ptr(6000)),
			member(uuid.New(), "", ptr(4000)),
		),
		withMembers(class("REITs", 4000), member(uuid.Nil, "HGLG11", nil)),
	)
}

func manyClasses(n int) Plan {
	classes := make([]PlanClass, n)
	for i := range classes {
		classes[i] = class(strings.Repeat("c", i+1), 0)
	}

	classes[0].TargetBP = 10000

	return Plan{Classes: classes}
}

func planOf(classes ...PlanClass) Plan {
	return Plan{Classes: classes}
}

func withAmount(p Plan, amount int64) Plan {
	m, err := money.New(amount, "BRL")
	if err != nil {
		panic(err)
	}

	p.Amount = &m

	return p
}

func class(name string, target int) PlanClass {
	return PlanClass{Name: name, TargetBP: target}
}

func withMembers(c PlanClass, members ...PlanMember) PlanClass {
	c.Members = members

	return c
}

func member(account uuid.UUID, instrument money.Currency, target *int) PlanMember {
	return PlanMember{AccountID: account, Instrument: instrument, TargetBP: target}
}

func ptr(v int) *int { return &v }
