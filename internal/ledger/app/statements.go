package app

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

// Statements lists a card's statements within [from, to]; nil bounds are open. Pages are
// cut in memory: each summary carries the unpaid amount of the previous statement, so
// every statement of the card is summarized anyway. A zero Limit returns every statement.
func (s *Service) Statements(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from, to *domain.ReferenceMonth,
	p page.Request[StatementKey],
) ([]StatementView, *StatementKey, domain.Account, error) {
	a, err := s.card(ctx, booksID, accountID)
	if err != nil {
		return nil, nil, domain.Account{}, err
	}

	all, err := s.statementSummaries(ctx, s.repo, booksID, accountID)
	if err != nil {
		return nil, nil, domain.Account{}, err
	}

	out := make([]StatementView, 0, len(all))
	for _, v := range all {
		ref := v.Input.Reference
		if (from != nil && ref.Compare(*from) < 0) || (to != nil && ref.Compare(*to) > 0) ||
			(p.After != nil && ref.String() <= p.After.Reference) {
			continue
		}

		out = append(out, v)
	}

	if p.Limit == 0 || len(out) <= p.Limit {
		return out, nil, a, nil
	}

	out = out[:p.Limit]

	return out, &StatementKey{Reference: out[len(out)-1].Input.Reference.String()}, a, nil
}

func (s *Service) Statement(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (StatementView, domain.Account, []StatementPosting, error) {
	accountID, err := s.repo.StatementAccount(ctx, booksID, id)
	if err != nil {
		return StatementView{}, domain.Account{}, nil, err
	}

	views, _, a, err := s.Statements(
		ctx,
		booksID,
		accountID,
		nil,
		nil,
		page.Request[StatementKey]{},
	)
	if err != nil {
		return StatementView{}, domain.Account{}, nil, err
	}

	postings, err := s.repo.StatementPostings(ctx, booksID, id)
	if err != nil {
		return StatementView{}, domain.Account{}, nil, err
	}

	for _, v := range views {
		if v.ID != id {
			continue
		}

		for i, p := range postings {
			postings[i].Provisional = domain.Provisional(
				p.Basis,
				p.Date,
				v.Input.Closing,
				v.Reconciled,
				p.Installment != nil,
			)
		}

		v.Explanation = s.explain(ctx, v, postings)

		return v, a, postings, nil
	}

	return StatementView{}, domain.Account{}, nil, ErrNotFound
}

// explain searches the provisional postings of a closed, unreconciled statement for the ones
// that close its difference with the institution's total (A137).
func (s *Service) explain(
	ctx context.Context,
	v StatementView,
	postings []StatementPosting,
) domain.DifferenceExplanation {
	if v.Fact == nil || v.Reconciled || s.clock.Today(ctx).Before(v.Input.Closing) {
		return domain.DifferenceExplanation{}
	}

	// A transaction moves whole: its provisional postings on the statement are one candidate.
	var candidates []domain.DifferenceCandidate
	for _, p := range postings {
		if !p.Provisional || p.CardRole == domain.RolePayment {
			continue
		}

		i := slices.IndexFunc(
			candidates,
			func(c domain.DifferenceCandidate) bool { return c.TransactionID == p.TransactionID },
		)
		if i < 0 {
			candidates = append(
				candidates,
				domain.DifferenceCandidate{TransactionID: p.TransactionID, Date: p.Date},
			)
			i = len(candidates) - 1
		}

		candidates[i].Amount += p.Amount
	}

	return domain.ExplainDifference(v.Summary.AmountDue-v.Fact.Total, len(postings), candidates)
}

// statementView loads a statement with its derived summary inside r.
func (s *Service) statementView(
	ctx context.Context,
	r Repository,
	booksID int64,
	statementID uuid.UUID,
) (StatementView, domain.Account, error) {
	accountID, err := r.StatementAccount(ctx, booksID, statementID)
	if err != nil {
		return StatementView{}, domain.Account{}, err
	}

	card, err := r.Account(ctx, booksID, accountID)
	if err != nil {
		return StatementView{}, domain.Account{}, err
	}

	views, err := s.statementSummaries(ctx, r, booksID, accountID)
	if err != nil {
		return StatementView{}, domain.Account{}, err
	}

	for _, v := range views {
		if v.ID == statementID {
			return v, card, nil
		}
	}

	return StatementView{}, domain.Account{}, ErrNotFound
}

// PayStatement moves amount from a balance account to the card (M08); the payment is billed
// on the statement of its date's cycle and settles the statement (A89).
func (s *Service) PayStatement(
	ctx context.Context,
	booksID int64,
	statementID uuid.UUID,
	date time.Time,
	from uuid.UUID,
	amount money.Money,
) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		v, card, err := s.statementView(ctx, r, booksID, statementID)
		if err != nil {
			return err
		}

		if amount.Amount() <= 0 {
			return validationError("amount", "must be positive")
		}

		ref := v.Input.Reference

		w, err := s.writerFor(ctx, booksID)
		if err != nil {
			return err
		}

		created, err = s.insert(ctx, r, domain.Transaction{
			BooksID:     booksID,
			Date:        date,
			Description: fmt.Sprintf(w.StatementPayment, ref.String()),
			Postings: []domain.Posting{
				{AccountID: card.ID, Amount: amount, CardRole: domain.RolePayment},
				{AccountID: from, Amount: amount.Neg()},
			},
		})

		return err
	})

	return created, err
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
	err := s.repo.InTx(ctx, func(r Repository) error {
		v, card, err := s.statementView(ctx, r, booksID, statementID)
		if err != nil {
			return err
		}

		if err := s.checkFinanceable(ctx, v, card, installment); err != nil {
			return err
		}

		unpaid, interest, err := financedAmounts(v, card, installment, count)
		if err != nil {
			return err
		}

		ref := v.Input.Reference

		postings, err := s.financingPostings(
			ctx,
			r,
			booksID,
			card,
			ref,
			planID,
			count,
			installment,
			unpaid,
			interest,
		)
		if err != nil {
			return err
		}

		w, err := s.writerFor(ctx, booksID)
		if err != nil {
			return err
		}

		created, err = s.insert(ctx, r, domain.Transaction{
			BooksID:     booksID,
			Date:        date,
			Description: fmt.Sprintf(w.StatementFinancing, ref.String()),
			Postings:    postings,
		})
		if err != nil {
			return err
		}

		err = insertFinancingPlan(ctx, r, booksID, planID, card, created, count, unpaid, interest)
		if err != nil {
			return err
		}

		return r.SetStatementFinanced(ctx, statementID, planID)
	})

	return created, planID, err
}

// insertFinancingPlan stores the plan that finances a statement through created.
func insertFinancingPlan(
	ctx context.Context,
	r Repository,
	booksID int64,
	planID uuid.UUID,
	card domain.Account,
	created domain.Transaction,
	count int,
	unpaid, interest money.Money,
) error {
	return r.InsertPlan(ctx, domain.InstallmentPlan{
		ID: planID, BooksID: booksID, AccountID: card.ID, OriginTransactionID: created.ID,
		Kind: domain.PlanFinancing, Count: count, Principal: unpaid, Interest: interest,
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
