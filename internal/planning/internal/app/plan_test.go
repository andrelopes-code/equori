package app

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
)

func TestPlanSavingsFigures(t *testing.T) {
	t.Parallel()

	fixed := func(amount int64, targetBP int, hasTarget bool) Plan {
		return Plan{Reference: domain.Reference{
			Source: domain.SourceFixed, Fixed: amount, HasFixed: true, TargetBP: targetBP, HasTarget: hasTarget,
		}}
	}

	tests := []struct {
		name        string
		plan        Plan
		savings     int64
		rate        int
		hasRate     bool
		target, gap int64
		hasTarget   bool
	}{
		{"rate truncates", fixed(800000, 0, false), 120000, 1500, true, 0, 0, false},
		{"rate truncates toward zero", fixed(300000, 0, false), 100000, 3333, true, 0, 0, false},
		{"target rounds down below the half", fixed(800001, 3333, true), 0, 0, true, 266640, 266640, true},
		{"target rounds up above the half", fixed(800005, 3333, true), 0, 0, true, 266642, 266642, true},
		{"target rounds half up at the half", fixed(10001, 5000, true), 0, 0, true, 5001, 5001, true},
		{"savings above the target leave no gap", fixed(800000, 2500, true), 250000, 3125, true, 200000, 0, true},
		{"zero reference has no figures", fixed(0, 2500, true), 100, 0, false, 0, 0, false},
		{"absent reference has no figures", Plan{Reference: domain.Reference{
			Source: domain.SourceExpectedIncome, TargetBP: 2500, HasTarget: true,
		}}, 100, 0, false, 0, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			tt.plan.Savings = tt.savings

			rate, ok := tt.plan.SavingsRate()
			if ok != tt.hasRate || rate != tt.rate {
				t.Errorf("SavingsRate = %d, %v; want %d, %v", rate, ok, tt.rate, tt.hasRate)
			}

			target, ok := tt.plan.SavingsTarget()
			if ok != tt.hasTarget || target != tt.target {
				t.Errorf("SavingsTarget = %d, %v; want %d, %v", target, ok, tt.target, tt.hasTarget)
			}

			gap, ok := tt.plan.SavingsGap()
			if ok != tt.hasTarget || gap != tt.gap {
				t.Errorf("SavingsGap = %d, %v; want %d, %v", gap, ok, tt.gap, tt.hasTarget)
			}
		})
	}
}

// A realized income whose transaction is missing from the facts has no entry, so the plan keeps
// its expected amount; expected occurrences and savings never get one.
func TestReceivedIncomeSkipsWhatTheFactsOmit(t *testing.T) {
	t.Parallel()

	account, other := uuid.New(), uuid.New()
	income := domain.Schedule{ID: uuid.New(), Kind: domain.Income, AccountID: account, CounterpartID: other}
	savings := domain.Schedule{ID: uuid.New(), Kind: domain.Savings, AccountID: account, CounterpartID: other}
	known, missing := uuid.New(), uuid.New()

	realized := domain.Occurrence{ID: uuid.New(), ScheduleID: income.ID, State: domain.Realized, TransactionID: known}
	omitted := domain.Occurrence{ID: uuid.New(), ScheduleID: income.ID, State: domain.Realized, TransactionID: missing}
	expected := domain.Occurrence{ID: uuid.New(), ScheduleID: income.ID, State: domain.Expected}
	saved := domain.Occurrence{ID: uuid.New(), ScheduleID: savings.ID, State: domain.Realized, TransactionID: known}

	svc := &Service{ledger: factsLedger{facts: []domain.Transaction{{
		ID:       known,
		Postings: []domain.Posting{{AccountID: account, Amount: 275142}, {AccountID: other, Amount: -275142}},
	}}}}

	got, err := svc.receivedIncome(
		context.Background(),
		1,
		[]domain.Occurrence{realized, omitted, expected, saved},
		map[uuid.UUID]domain.Schedule{income.ID: income, savings.ID: savings},
	)
	if err != nil {
		t.Fatalf("receivedIncome: %v", err)
	}

	if len(got) != 1 || got[realized.ID] != 275142 {
		t.Fatalf("receivedIncome = %v, want only the realized occurrence at 275142", got)
	}
}

type factsLedger struct {
	Ledger
	facts []domain.Transaction
}

func (l factsLedger) TransactionFacts(context.Context, int64, []uuid.UUID) ([]domain.Transaction, error) {
	return l.facts, nil
}
