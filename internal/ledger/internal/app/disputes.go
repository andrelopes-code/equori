package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	OutcomeWon  = "won"
	OutcomeLost = "lost"
)

// OpenDispute flags a card purchase as contested; its postings stay in their categories (S13).
func (s *Service) OpenDispute(ctx context.Context, userID int64, transactionID uuid.UUID, openedOn time.Time) (Dispute, error) {
	var d Dispute
	err := s.repo.InTx(ctx, func(r Repository) error {
		if _, err := s.lockPurchase(ctx, r, userID, transactionID); err != nil {
			return err
		}
		var err error
		d, err = r.InsertDispute(ctx, Dispute{UserID: userID, TransactionID: transactionID, OpenedOn: openedOn})
		return err
	})
	return d, err
}

// Disputes lists the disputes of a transaction, oldest first.
func (s *Service) Disputes(ctx context.Context, userID int64, transactionID uuid.UUID) ([]Dispute, error) {
	if _, err := s.repo.Transaction(ctx, userID, transactionID); err != nil {
		return nil, err
	}
	return s.repo.Disputes(ctx, userID, transactionID)
}

// ResolveDispute closes a dispute; a won dispute credits the charged amount not yet
// refunded, linked chargeback_of the purchase (M22).
func (s *Service) ResolveDispute(ctx context.Context, userID int64, id uuid.UUID, resolvedOn time.Time, outcome string, statement *domain.ReferenceMonth) (Dispute, error) {
	if outcome != OutcomeWon && outcome != OutcomeLost {
		return Dispute{}, validationError("outcome", "must be won or lost")
	}
	var resolved Dispute
	err := s.repo.InTx(ctx, func(r Repository) error {
		d, err := r.LockDispute(ctx, userID, id)
		if err != nil {
			return err
		}
		if d.ResolvedOn != nil {
			return ErrDisputeResolved
		}
		if resolvedOn.Before(d.OpenedOn) {
			return validationError("resolved_on", "must not be before opened_on")
		}
		d.ResolvedOn, d.Outcome = &resolvedOn, outcome
		if outcome == OutcomeWon {
			pu, err := s.lockPurchase(ctx, r, userID, d.TransactionID)
			if err != nil {
				return err
			}
			done, err := r.RefundedTotal(ctx, userID, pu.tx.ID)
			if err != nil {
				return err
			}
			remaining, err := money.New(pu.charged-done, pu.card.Instrument)
			if err != nil {
				return err
			}
			if remaining.Amount() > 0 {
				reversals, err := pu.reverseCategories(remaining.Amount())
				if err != nil {
					return err
				}
				w, err := s.writerFor(ctx, userID)
				if err != nil {
					return err
				}
				refund, err := s.insert(ctx, r, domain.Transaction{
					UserID: userID, Date: resolvedOn, Description: fmt.Sprintf(w.Chargeback, pu.tx.Description), PayeeID: pu.tx.PayeeID,
					Postings: append([]domain.Posting{{AccountID: pu.card.ID, Amount: remaining, CardRole: domain.RoleCredit, Statement: statement}}, reversals...),
					Links:    []domain.Link{{Type: domain.LinkChargebackOf, Target: pu.tx.ID}},
				})
				if err != nil {
					return err
				}
				d.RefundTransactionID = refund.ID
			}
		}
		resolved, err = r.ResolveDispute(ctx, d)
		return err
	})
	return resolved, err
}
