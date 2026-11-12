package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// financing is one request to finance a statement.
type financing struct {
	booksID     int64
	statementID uuid.UUID
	planID      uuid.UUID
	date        time.Time
	count       int
	installment money.Money
}

// FinanceStatement converts the unpaid amount of a closed statement into installments on
// the following statements; interest is the installments' total minus the unpaid amount (S11).
func (s *Service) FinanceStatement(
	ctx context.Context,
	booksID int64,
	statementID uuid.UUID,
	date time.Time,
	count int,
	installment money.Money,
) (domain.Transaction, uuid.UUID, error) {
	if count < 2 || count > maxInstallments {
		return domain.Transaction{}, uuid.Nil, validationError(
			"installment_count",
			"must be between 2 and 420",
		)
	}

	var created domain.Transaction
	planID := uuid.Must(uuid.NewV7())
	f := financing{
		booksID:     booksID,
		statementID: statementID,
		planID:      planID,
		date:        date,
		count:       count,
		installment: installment,
	}
	err := s.repo.InTx(ctx, func(r Repository) (err error) {
		created, err = s.finance(ctx, r, f)

		return err
	})

	return created, planID, err
}

// finance inserts the financing transaction and its plan and marks the statement financed.
func (s *Service) finance(
	ctx context.Context,
	r Repository,
	f financing,
) (created domain.Transaction, err error) {
	v, card, unpaid, interest, err := s.financeView(
		ctx,
		r,
		f.booksID,
		f.statementID,
		f.installment,
		f.count,
	)
	if err != nil {
		return created, err
	}

	ref := v.Input.Reference

	postings, err := s.financingPostings(
		ctx,
		r,
		f.booksID,
		card,
		ref,
		f.planID,
		f.count,
		f.installment,
		unpaid,
		interest,
	)
	if err != nil {
		return created, err
	}

	created, err = s.insertFinancing(ctx, r, f.booksID, f.date, ref, postings)
	if err != nil {
		return created, err
	}

	err = insertFinancingPlan(ctx, r, f, card, created, unpaid, interest)
	if err != nil {
		return created, err
	}

	return created, r.SetStatementFinanced(ctx, f.statementID, f.planID)
}

// financeView loads the statement and checks that it can be financed, with the amounts the
// plan carries.
func (s *Service) financeView(
	ctx context.Context,
	r Repository,
	booksID int64,
	statementID uuid.UUID,
	installment money.Money,
	count int,
) (v StatementView, card domain.Account, unpaid, interest money.Money, err error) {
	v, card, err = s.statementView(ctx, r, booksID, statementID)
	if err != nil {
		return v, card, unpaid, interest, err
	}

	if err = s.checkFinanceable(ctx, v, card, installment); err != nil {
		return v, card, unpaid, interest, err
	}

	unpaid, interest, err = financedAmounts(v, card, installment, count)

	return v, card, unpaid, interest, err
}

// insertFinancing stores the transaction that finances the statement of ref.
func (s *Service) insertFinancing(
	ctx context.Context,
	r Repository,
	booksID int64,
	date time.Time,
	ref domain.ReferenceMonth,
	postings []domain.Posting,
) (domain.Transaction, error) {
	w, err := s.writerFor(ctx, booksID)
	if err != nil {
		return domain.Transaction{}, err
	}

	return s.insert(ctx, r, domain.Transaction{
		BooksID:     booksID,
		Date:        date,
		Description: fmt.Sprintf(w.StatementFinancing, ref.String()),
		Postings:    postings,
	})
}

// insertFinancingPlan stores the plan that finances a statement through created.
func insertFinancingPlan(
	ctx context.Context,
	r Repository,
	f financing,
	card domain.Account,
	created domain.Transaction,
	unpaid, interest money.Money,
) error {
	return r.InsertPlan(ctx, domain.InstallmentPlan{
		ID: f.planID, BooksID: f.booksID, AccountID: card.ID, OriginTransactionID: created.ID,
		Kind: domain.PlanFinancing, Count: f.count, Principal: unpaid, Interest: interest,
		FirstStatementID: firstCardStatement(created, card.ID),
	})
}

// checkFinanceable rejects a statement that is financed, open, paid, or given an invalid
// installment.
func (s *Service) checkFinanceable(
	ctx context.Context,
	v StatementView,
	card domain.Account,
	installment money.Money,
) error {
	switch {
	case v.FinancedBy != uuid.Nil:
		return ErrStatementFinanced
	case s.clock.Today(ctx).Before(v.Input.Closing):
		return ErrStatementNotClosed
	case v.Summary.Unpaid <= 0:
		return validationError("statement", "has no unpaid amount")
	case installment.Currency() != card.Instrument || installment.Amount() <= 0:
		return validationError("installment_amount", "must be positive and in the card currency")
	}

	return nil
}

// financedAmounts returns the unpaid amount of the statement and the interest the installments
// add to it.
func financedAmounts(
	v StatementView,
	card domain.Account,
	installment money.Money,
	count int,
) (unpaid, interest money.Money, err error) {
	unpaid, err = money.New(v.Summary.Unpaid, card.Instrument)
	if err != nil {
		return unpaid, interest, err
	}

	interest, err = money.New(installment.Amount()*int64(count)-unpaid.Amount(), card.Instrument)
	if err != nil || interest.IsNegative() {
		return unpaid, interest, validationError(
			"installment_amount",
			"installments must cover the unpaid amount",
		)
	}

	return unpaid, interest, nil
}

// financingPostings returns the payment of the unpaid amount, one charge per installment and the
// interest.
func (s *Service) financingPostings(
	ctx context.Context,
	r Repository,
	booksID int64,
	card domain.Account,
	ref domain.ReferenceMonth,
	planID uuid.UUID,
	count int,
	installment, unpaid, interest money.Money,
) ([]domain.Posting, error) {
	postings := []domain.Posting{{AccountID: card.ID, Amount: unpaid, CardRole: domain.RolePayment}}
	for k := 1; k <= count; k++ {
		next := ref.Add(k)
		postings = append(postings, domain.Posting{
			AccountID:   card.ID,
			Amount:      installment.Neg(),
			CardRole:    domain.RoleCharge,
			Statement:   &next,
			Installment: &domain.InstallmentRef{PlanID: planID, Number: k, Count: count},
		})
	}

	if !interest.IsZero() {
		interestAccount, err := r.SystemAccount(ctx, booksID, domain.RoleInterest)
		if err != nil {
			return nil, err
		}

		postings = append(postings, domain.Posting{AccountID: interestAccount.ID, Amount: interest})
	}

	return postings, nil
}
