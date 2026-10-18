package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
)

// ScheduledInstallment is one installment of a plan; Reversed marks one credited back
// on its statement by an active cancellation or anticipation.
type ScheduledInstallment struct {
	Number    int
	Reference domain.ReferenceMonth
	Amount    int64 // positive: the amount charged
	Reversed  bool
}

// PlanView is an installment plan with its derived status and schedule.
type PlanView struct {
	Plan         domain.InstallmentPlan
	Status       string // active, cancelled or anticipated
	Installments []ScheduledInstallment
}

// InstallmentPlan returns the plan, its schedule and its status. A non-voided
// cancellation reverses every installment; a non-voided anticipation reverses the
// installments whose statement it credited.
func (s *Service) InstallmentPlan(ctx context.Context, userID int64, id uuid.UUID) (PlanView, error) {
	plan, err := s.repo.Plan(ctx, userID, id)
	if err != nil {
		return PlanView{}, err
	}
	installments, err := s.repo.PlanInstallments(ctx, userID, id)
	if err != nil {
		return PlanView{}, err
	}
	cancelled, anticipated, err := s.repo.PlanState(ctx, userID, plan.OriginTransactionID)
	if err != nil {
		return PlanView{}, err
	}
	var credited map[domain.ReferenceMonth]struct{}
	if anticipated && !cancelled {
		if credited, err = s.repo.AnticipatedReferences(ctx, userID, plan.OriginTransactionID); err != nil {
			return PlanView{}, err
		}
	}
	view := PlanView{Plan: plan, Status: "active", Installments: make([]ScheduledInstallment, len(installments))}
	switch {
	case cancelled:
		view.Status = "cancelled"
	case anticipated:
		view.Status = "anticipated"
	}
	for i, in := range installments {
		_, anticipatedHere := credited[in.Reference]
		view.Installments[i] = ScheduledInstallment{Number: in.Number, Reference: in.Reference, Amount: -in.Amount, Reversed: cancelled || anticipatedHere}
	}
	return view, nil
}
