package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// purchase is a locked origin transaction with its card, charged total and category postings.
type purchase struct {
	tx         domain.Transaction
	card       domain.Account
	charged    int64 // sum of card charges, positive
	categories []domain.Posting
}

func (s *Service) lockPurchase(
	ctx context.Context,
	r Repository,
	booksID int64,
	id uuid.UUID,
) (purchase, error) {
	t, err := r.LockTransaction(ctx, booksID, id)
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

	accounts, err := r.Accounts(ctx, booksID, ids)
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
	done, err := r.RefundedTotal(ctx, pu.tx.BooksID, pu.tx.ID)
	if err != nil {
		return err
	}

	discount, err := r.AnticipationDiscount(ctx, pu.tx.BooksID, pu.tx.ID)
	if err != nil {
		return err
	}

	if charged := pu.charged - discount; done+adding > charged {
		return validationError(
			"amount",
			fmt.Sprintf("refunds would total %d, above the charged %d", done+adding, charged),
		)
	}

	return nil
}

// RefundPurchase credits amount on the card and takes it back from the categories (M06, S08).
func (s *Service) RefundPurchase(
	ctx context.Context,
	booksID int64,
	originID uuid.UUID,
	date time.Time,
	amount money.Money,
	statement *domain.ReferenceMonth,
) (domain.Transaction, error) {
	if amount.Amount() <= 0 {
		return domain.Transaction{}, validationError("amount", "must be positive")
	}

	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		pu, err := s.lockPurchase(ctx, r, booksID, originID)
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

		postings := append(
			[]domain.Posting{
				{
					AccountID: pu.card.ID,
					Amount:    amount,
					CardRole:  domain.RoleCredit,
					Statement: statement,
				},
			},
			reversals...)

		w, err := s.writerFor(ctx, booksID)
		if err != nil {
			return err
		}

		created, err = s.insert(ctx, r, domain.Transaction{
			BooksID:     booksID,
			Date:        date,
			Description: fmt.Sprintf(w.Refund, pu.tx.Description),
			PayeeID:     pu.tx.PayeeID,
			Postings:    postings,
			Links:       []domain.Link{{Type: domain.LinkRefundOf, Target: originID}},
		})

		return err
	})

	return created, err
}

func (s *Service) lockPlan(
	ctx context.Context,
	r Repository,
	booksID int64,
	planID uuid.UUID,
) (domain.InstallmentPlan, purchase, []PlanInstallment, error) {
	plan, err := r.Plan(ctx, booksID, planID)
	if err != nil {
		return domain.InstallmentPlan{}, purchase{}, nil, err
	}

	pu, err := s.lockPurchase(ctx, r, booksID, plan.OriginTransactionID)
	if err != nil {
		return domain.InstallmentPlan{}, purchase{}, nil, err
	}

	installments, err := r.PlanInstallments(ctx, booksID, planID)

	return plan, pu, installments, err
}

// CancelPlan reverses unbilled installments on their statements and credits billed ones
// on creditStatement (default: the statement the date falls in) (M25, S14, T08). An
// installment an anticipation reversed stays reversed; the anticipation's charge is reversed
// or credited in its place and its discount returns (A135).
func (s *Service) CancelPlan(
	ctx context.Context,
	booksID int64,
	planID uuid.UUID,
	date time.Time,
	creditStatement *domain.ReferenceMonth,
) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		_, pu, installments, err := s.lockPlan(ctx, r, booksID, planID)
		if err != nil {
			return err
		}

		st, err := s.loadCancelState(ctx, r, booksID, pu, installments)
		if err != nil {
			return err
		}

		postings, credited, err := cancelPostings(pu, st.open, date, creditStatement)
		if err != nil {
			return err
		}

		if err := s.checkCeiling(ctx, r, pu, credited); err != nil {
			return err
		}

		reversals, err := s.cancelReversals(ctx, r, booksID, pu, st)
		if err != nil {
			return err
		}

		created, err = s.insertCancellation(
			ctx,
			r,
			booksID,
			pu,
			date,
			append(postings, reversals...),
		)

		return err
	})

	return created, err
}

// cancelState holds what the cancellation of a plan reverses: the installments still open,
// their total and the discount the anticipations granted.
type cancelState struct {
	open     []PlanInstallment
	total    int64
	discount int64
}

func (s *Service) loadCancelState(
	ctx context.Context,
	r Repository,
	booksID int64,
	pu purchase,
	installments []PlanInstallment,
) (cancelState, error) {
	anticipated, err := r.AnticipatedReferences(ctx, booksID, pu.tx.ID)
	if err != nil {
		return cancelState{}, err
	}

	charges, err := r.AnticipationCharges(ctx, booksID, pu.tx.ID)
	if err != nil {
		return cancelState{}, err
	}

	discount, err := r.AnticipationDiscount(ctx, booksID, pu.tx.ID)
	if err != nil {
		return cancelState{}, err
	}

	st := cancelState{open: charges, discount: discount}
	for _, in := range installments {
		st.total -= in.Amount
		if _, ok := anticipated[in.Reference]; !ok {
			st.open = append(st.open, in)
		}
	}

	return st, nil
}

// cancelPostings returns the card postings that reverse or credit the open installments and
// the amount they credit.
func cancelPostings(
	pu purchase,
	open []PlanInstallment,
	date time.Time,
	creditStatement *domain.ReferenceMonth,
) ([]domain.Posting, int64, error) {
	var postings []domain.Posting
	var billed, credited int64

	for _, in := range open {
		credited -= in.Amount
		if !in.Closing.After(date) {
			billed -= in.Amount
			continue
		}

		ref := in.Reference

		m, err := money.New(-in.Amount, pu.card.Instrument)
		if err != nil {
			return nil, 0, err
		}

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

	if billed > 0 {
		m, err := money.New(billed, pu.card.Instrument)
		if err != nil {
			return nil, 0, err
		}

		postings = append(
			postings,
			domain.Posting{
				AccountID: pu.card.ID,
				Amount:    m,
				CardRole:  domain.RoleCredit,
				Statement: creditStatement,
			},
		)
	}

	return postings, credited, nil
}

// cancelReversals returns the postings that reverse the categories of the purchase and the
// discount of its anticipations.
func (s *Service) cancelReversals(
	ctx context.Context,
	r Repository,
	booksID int64,
	pu purchase,
	st cancelState,
) ([]domain.Posting, error) {
	reversals, err := pu.reverseCategories(st.total)
	if err != nil {
		return nil, err
	}

	if st.discount > 0 {
		discounts, err := r.SystemAccount(ctx, booksID, domain.RoleDiscounts)
		if err != nil {
			return nil, err
		}

		m, err := money.New(st.discount, pu.card.Instrument)
		if err != nil {
			return nil, err
		}

		reversals = append(reversals, domain.Posting{AccountID: discounts.ID, Amount: m})
	}

	return reversals, nil
}

func (s *Service) insertCancellation(
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
		Description: fmt.Sprintf(w.Cancellation, pu.tx.Description),
		PayeeID:     pu.tx.PayeeID,
		Postings:    postings,
		Links:       []domain.Link{{Type: domain.LinkCancellationOf, Target: pu.tx.ID}},
	})
}
