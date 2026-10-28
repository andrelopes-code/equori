package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// purchase is a locked origin transaction with its card, charged total and category postings.
type purchase struct {
	tx         domain.Transaction
	card       domain.Account
	charged    int64 // sum of card charges, positive
	categories []domain.Posting
}

func (s *Service) lockPurchase(ctx context.Context, r Repository, userID int64, id uuid.UUID) (purchase, error) {
	t, err := r.LockTransaction(ctx, userID, id)
	if err != nil {
		return purchase{}, err
	}
	if t.VoidedAt != nil {
		return purchase{}, domain.ErrVoided
	}
	ids := make([]uuid.UUID, 0, len(t.Postings))
	for _, p := range t.Postings {
		ids = append(ids, p.AccountID)
	}
	accounts, err := r.Accounts(ctx, userID, ids)
	if err != nil {
		return purchase{}, err
	}
	pu := purchase{tx: t}
	for _, p := range t.Postings {
		a := accounts[p.AccountID]
		switch {
		case p.CardRole == domain.RoleCharge:
			pu.card = a
			pu.charged -= p.Amount.Amount()
		case (a.Class == domain.ClassExpense || a.Class == domain.ClassIncome) && !p.Amount.IsNegative():
			pu.categories = append(pu.categories, p)
		}
	}
	if pu.charged == 0 || len(pu.categories) == 0 {
		return purchase{}, validationError("transaction_id", "is not a card purchase")
	}
	return pu, nil
}

// reverseCategories returns negative postings that take amount back from the purchase's categories (A6).
func (pu purchase) reverseCategories(amount int64) ([]domain.Posting, error) {
	shares := make([]int64, len(pu.categories))
	for i, p := range pu.categories {
		shares[i] = p.Amount.Amount()
	}
	out := make([]domain.Posting, 0, len(shares))
	for i, part := range domain.Allocate(amount, shares) {
		if part == 0 {
			continue
		}
		m, err := money.New(-part, pu.categories[i].Amount.Currency())
		if err != nil {
			return nil, err
		}
		out = append(out, domain.Posting{AccountID: pu.categories[i].AccountID, Amount: m})
	}
	return out, nil
}

// checkCeiling enforces I06: refunds and cancellations never exceed the charged total less
// the discount of anticipations (A135).
func (s *Service) checkCeiling(ctx context.Context, r Repository, pu purchase, adding int64) error {
	done, err := r.RefundedTotal(ctx, pu.tx.UserID, pu.tx.ID)
	if err != nil {
		return err
	}
	discount, err := r.AnticipationDiscount(ctx, pu.tx.UserID, pu.tx.ID)
	if err != nil {
		return err
	}
	if charged := pu.charged - discount; done+adding > charged {
		return validationError("amount", fmt.Sprintf("refunds would total %d, above the charged %d", done+adding, charged))
	}
	return nil
}

// RefundPurchase credits amount on the card and takes it back from the categories (M06, S08).
func (s *Service) RefundPurchase(ctx context.Context, userID int64, originID uuid.UUID, date time.Time, amount money.Money, statement *domain.ReferenceMonth) (domain.Transaction, error) {
	if amount.Amount() <= 0 {
		return domain.Transaction{}, validationError("amount", "must be positive")
	}
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		pu, err := s.lockPurchase(ctx, r, userID, originID)
		if err != nil {
			return err
		}
		if err := s.checkCeiling(ctx, r, pu, amount.Amount()); err != nil {
			return err
		}
		reversals, err := pu.reverseCategories(amount.Amount())
		if err != nil {
			return err
		}
		postings := append([]domain.Posting{{AccountID: pu.card.ID, Amount: amount, CardRole: domain.RoleCredit, Statement: statement}}, reversals...)
		w, err := s.writerFor(ctx, userID)
		if err != nil {
			return err
		}
		created, err = s.insert(ctx, r, domain.Transaction{
			UserID: userID, Date: date, Description: fmt.Sprintf(w.Refund, pu.tx.Description), PayeeID: pu.tx.PayeeID,
			Postings: postings, Links: []domain.Link{{Type: domain.LinkRefundOf, Target: originID}},
		})
		return err
	})
	return created, err
}

func (s *Service) lockPlan(ctx context.Context, r Repository, userID int64, planID uuid.UUID) (domain.InstallmentPlan, purchase, []PlanInstallment, error) {
	plan, err := r.Plan(ctx, userID, planID)
	if err != nil {
		return domain.InstallmentPlan{}, purchase{}, nil, err
	}
	pu, err := s.lockPurchase(ctx, r, userID, plan.OriginTransactionID)
	if err != nil {
		return domain.InstallmentPlan{}, purchase{}, nil, err
	}
	installments, err := r.PlanInstallments(ctx, userID, planID)
	return plan, pu, installments, err
}

// CancelPlan reverses unbilled installments on their statements and credits billed ones
// on creditStatement (default: the statement the date falls in) (M25, S14, T08). An
// installment an anticipation reversed stays reversed; the anticipation's charge is reversed
// or credited in its place and its discount returns (A135).
func (s *Service) CancelPlan(ctx context.Context, userID int64, planID uuid.UUID, date time.Time, creditStatement *domain.ReferenceMonth) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		_, pu, installments, err := s.lockPlan(ctx, r, userID, planID)
		if err != nil {
			return err
		}
		anticipated, err := r.AnticipatedReferences(ctx, userID, pu.tx.ID)
		if err != nil {
			return err
		}
		charges, err := r.AnticipationCharges(ctx, userID, pu.tx.ID)
		if err != nil {
			return err
		}
		discount, err := r.AnticipationDiscount(ctx, userID, pu.tx.ID)
		if err != nil {
			return err
		}
		var postings []domain.Posting
		var total, billed, credited int64
		open := charges
		for _, in := range installments {
			total -= in.Amount
			if _, ok := anticipated[in.Reference]; !ok {
				open = append(open, in)
			}
		}
		for _, in := range open {
			credited -= in.Amount
			if !in.Closing.After(date) {
				billed -= in.Amount
				continue
			}
			ref := in.Reference
			m, err := money.New(-in.Amount, pu.card.Instrument)
			if err != nil {
				return err
			}
			postings = append(postings, domain.Posting{AccountID: pu.card.ID, Amount: m, CardRole: domain.RoleCredit, Statement: &ref})
		}
		if billed > 0 {
			m, err := money.New(billed, pu.card.Instrument)
			if err != nil {
				return err
			}
			postings = append(postings, domain.Posting{AccountID: pu.card.ID, Amount: m, CardRole: domain.RoleCredit, Statement: creditStatement})
		}
		if err := s.checkCeiling(ctx, r, pu, credited); err != nil {
			return err
		}
		reversals, err := pu.reverseCategories(total)
		if err != nil {
			return err
		}
		if discount > 0 {
			discounts, err := r.SystemAccount(ctx, userID, domain.RoleDiscounts)
			if err != nil {
				return err
			}
			m, err := money.New(discount, pu.card.Instrument)
			if err != nil {
				return err
			}
			reversals = append(reversals, domain.Posting{AccountID: discounts.ID, Amount: m})
		}
		w, err := s.writerFor(ctx, userID)
		if err != nil {
			return err
		}
		created, err = s.insert(ctx, r, domain.Transaction{
			UserID: userID, Date: date, Description: fmt.Sprintf(w.Cancellation, pu.tx.Description), PayeeID: pu.tx.PayeeID,
			Postings: append(postings, reversals...), Links: []domain.Link{{Type: domain.LinkCancellationOf, Target: pu.tx.ID}},
		})
		return err
	})
	return created, err
}

// AnticipatePlan moves installments from..to to the target statement for amount; the
// difference to their sum is a discount (M26, S15).
func (s *Service) AnticipatePlan(ctx context.Context, userID int64, planID uuid.UUID, date time.Time, from, to int, target domain.ReferenceMonth, amount money.Money) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		plan, pu, installments, err := s.lockPlan(ctx, r, userID, planID)
		if err != nil {
			return err
		}
		if from < 1 || to < from || to > plan.Count {
			return validationError("from_installment", fmt.Sprintf("installments must be within 1..%d", plan.Count))
		}
		cancelled, _, err := r.PlanState(ctx, userID, pu.tx.ID)
		if err != nil {
			return err
		}
		if cancelled {
			return validationError("from_installment", "the plan is cancelled")
		}
		anticipated, err := r.AnticipatedReferences(ctx, userID, pu.tx.ID)
		if err != nil {
			return err
		}
		var postings []domain.Posting
		var sum int64
		for _, in := range installments {
			if in.Number < from || in.Number > to {
				continue
			}
			if !in.Closing.After(date) {
				return validationError("from_installment", fmt.Sprintf("installment %d is already billed", in.Number))
			}
			if _, ok := anticipated[in.Reference]; ok {
				return validationError("from_installment", fmt.Sprintf("installment %d is already anticipated", in.Number))
			}
			ref := in.Reference
			m, err := money.New(-in.Amount, pu.card.Instrument)
			if err != nil {
				return err
			}
			sum -= in.Amount
			postings = append(postings, domain.Posting{AccountID: pu.card.ID, Amount: m, CardRole: domain.RoleCredit, Statement: &ref})
		}
		if amount.Currency() != pu.card.Instrument || amount.Amount() <= 0 || amount.Amount() > sum {
			return validationError("amount", fmt.Sprintf("must be positive and at most the installments' sum %d", sum))
		}
		postings = append(postings, domain.Posting{AccountID: pu.card.ID, Amount: amount.Neg(), CardRole: domain.RoleCharge, Statement: &target})
		if discount := sum - amount.Amount(); discount > 0 {
			discounts, err := r.SystemAccount(ctx, userID, domain.RoleDiscounts)
			if err != nil {
				return err
			}
			m, err := money.New(-discount, pu.card.Instrument)
			if err != nil {
				return err
			}
			postings = append(postings, domain.Posting{AccountID: discounts.ID, Amount: m})
		}
		w, err := s.writerFor(ctx, userID)
		if err != nil {
			return err
		}
		created, err = s.insert(ctx, r, domain.Transaction{
			UserID: userID, Date: date, Description: fmt.Sprintf(w.Anticipation, pu.tx.Description), PayeeID: pu.tx.PayeeID,
			Postings: postings, Links: []domain.Link{{Type: domain.LinkAnticipationOf, Target: pu.tx.ID}},
		})
		return err
	})
	return created, err
}
