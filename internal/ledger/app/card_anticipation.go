package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// AnticipatePlan moves installments from..to to the target statement for amount; the
// difference to their sum is a discount (M26, S15).
func (s *Service) AnticipatePlan(
	ctx context.Context,
	booksID int64,
	planID uuid.UUID,
	date time.Time,
	from, to int,
	target domain.ReferenceMonth,
	amount money.Money,
) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		plan, pu, installments, err := s.lockPlan(ctx, r, booksID, planID)
		if err != nil {
			return err
		}

		anticipated, err := s.loadAnticipated(ctx, r, booksID, plan, pu, from, to)
		if err != nil {
			return err
		}

		postings, sum, err := anticipationPostings(pu, installments, anticipated, date, from, to)
		if err != nil {
			return err
		}

		postings, err = s.addAnticipationCharge(ctx, r, booksID, pu, postings, sum, amount, target)
		if err != nil {
			return err
		}

		created, err = s.insertAnticipation(ctx, r, booksID, pu, date, postings)

		return err
	})

	return created, err
}

// loadAnticipated checks the installment range and the state of the plan, then returns the
// statements earlier anticipations credited.
func (s *Service) loadAnticipated(
	ctx context.Context,
	r Repository,
	booksID int64,
	plan domain.InstallmentPlan,
	pu purchase,
	from, to int,
) (map[domain.ReferenceMonth]struct{}, error) {
	if from < 1 || to < from || to > plan.Count {
		return nil, validationError(
			"from_installment",
			fmt.Sprintf("installments must be within 1..%d", plan.Count),
		)
	}

	cancelled, _, err := r.PlanState(ctx, booksID, pu.tx.ID)
	if err != nil {
		return nil, err
	}

	if cancelled {
		return nil, validationError("from_installment", "the plan is cancelled")
	}

	return r.AnticipatedReferences(ctx, booksID, pu.tx.ID)
}

// anticipationPostings returns the card postings that reverse installments from..to and their sum.
func anticipationPostings(
	pu purchase,
	installments []PlanInstallment,
	anticipated map[domain.ReferenceMonth]struct{},
	date time.Time,
	from, to int,
) ([]domain.Posting, int64, error) {
	var postings []domain.Posting

	var sum int64
	for _, in := range installments {
		if in.Number < from || in.Number > to {
			continue
		}

		if !in.Closing.After(date) {
			return nil, 0, validationError(
				"from_installment",
				fmt.Sprintf("installment %d is already billed", in.Number),
			)
		}

		if _, ok := anticipated[in.Reference]; ok {
			return nil, 0, validationError(
				"from_installment",
				fmt.Sprintf("installment %d is already anticipated", in.Number),
			)
		}

		ref := in.Reference

		m, err := money.New(-in.Amount, pu.card.Instrument)
		if err != nil {
			return nil, 0, err
		}

		sum -= in.Amount
		postings = append(
			postings,
			domain.Posting{
				AccountID: pu.card.ID,
				Amount:    m,
				CardRole:  domain.RoleCredit,
				Statement: &ref,
			},
		)
	}

	return postings, sum, nil
}

// addAnticipationCharge validates amount against sum, then appends the charge on target and
// the discount.
func (s *Service) addAnticipationCharge(
	ctx context.Context,
	r Repository,
	booksID int64,
	pu purchase,
	postings []domain.Posting,
	sum int64,
	amount money.Money,
	target domain.ReferenceMonth,
) ([]domain.Posting, error) {
	if amount.Currency() != pu.card.Instrument || amount.Amount() <= 0 || amount.Amount() > sum {
		return nil, validationError(
			"amount",
			fmt.Sprintf("must be positive and at most the installments' sum %d", sum),
		)
	}

	postings = append(
		postings,
		domain.Posting{
			AccountID: pu.card.ID,
			Amount:    amount.Neg(),
			CardRole:  domain.RoleCharge,
			Statement: &target,
		},
	)
	if discount := sum - amount.Amount(); discount > 0 {
		discounts, err := r.SystemAccount(ctx, booksID, domain.RoleDiscounts)
		if err != nil {
			return nil, err
		}

		m, err := money.New(-discount, pu.card.Instrument)
		if err != nil {
			return nil, err
		}

		postings = append(postings, domain.Posting{AccountID: discounts.ID, Amount: m})
	}

	return postings, nil
}

func (s *Service) insertAnticipation(
	ctx context.Context,
	r Repository,
	booksID int64,
	pu purchase,
	date time.Time,
	postings []domain.Posting,
) (domain.Transaction, error) {
	w, err := s.writerFor(ctx, booksID)
	if err != nil {
		return domain.Transaction{}, err
	}

	return s.insert(ctx, r, domain.Transaction{
		BooksID:     booksID,
		Date:        date,
		Description: fmt.Sprintf(w.Anticipation, pu.tx.Description),
		PayeeID:     pu.tx.PayeeID,
		Postings:    postings,
		Links:       []domain.Link{{Type: domain.LinkAnticipationOf, Target: pu.tx.ID}},
	})
}
