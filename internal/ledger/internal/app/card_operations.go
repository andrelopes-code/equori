package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type InstallmentPurchaseInput struct {
	CardAccountID  uuid.UUID
	Date           time.Time
	Description    string
	PayeeID        uuid.UUID
	Tags           []string
	Splits         []domain.Posting
	Count          int
	Interest       *money.Money
	FirstStatement *domain.ReferenceMonth
	Amounts        []money.Money // issuer amounts, overriding the DM3 split
}

const maxInstallments = 420

func validationError(field, message string) error {
	return &domain.FieldError{Field: field, Message: message, Err: domain.ErrValidation}
}

// InstallmentPurchase records the full expense now and one card charge per statement (S06, S07, DM2, DM3).
func (s *Service) InstallmentPurchase(ctx context.Context, userID int64, in InstallmentPurchaseInput) (domain.Transaction, uuid.UUID, error) {
	if in.Count < 2 || in.Count > maxInstallments {
		return domain.Transaction{}, uuid.Nil, validationError("installment_count", "must be between 2 and 420")
	}
	if len(in.Splits) == 0 {
		return domain.Transaction{}, uuid.Nil, validationError("splits", "at least one split is required")
	}
	var created domain.Transaction
	planID := uuid.Must(uuid.NewV7())
	err := s.repo.InTx(ctx, func(r Repository) error {
		card, err := r.Account(ctx, userID, in.CardAccountID)
		if err != nil {
			return err
		}
		if err := domain.RequireCard(card); err != nil {
			return &domain.FieldError{Field: "card_account_id", Message: "must be a credit card account", Err: domain.ErrValidation}
		}
		principal, interest, err := purchaseTotals(card.Instrument, in)
		if err != nil {
			return err
		}
		total, err := principal.Add(interest)
		if err != nil {
			return err
		}
		parts, err := installmentParts(total, in)
		if err != nil {
			return err
		}
		first, err := s.firstStatement(ctx, r, userID, card.ID, in)
		if err != nil {
			return err
		}
		postings := append([]domain.Posting{}, in.Splits...)
		if !interest.IsZero() {
			interestAccount, err := r.SystemAccount(ctx, userID, domain.RoleInterest)
			if err != nil {
				return err
			}
			postings = append(postings, domain.Posting{AccountID: interestAccount.ID, Amount: interest})
		}
		for k, part := range parts {
			ref := domain.InstallmentStatement(first, k+1)
			postings = append(postings, domain.Posting{
				AccountID: card.ID, Amount: part.Neg(), CardRole: domain.RoleCharge, Statement: &ref,
				Installment: &domain.InstallmentRef{PlanID: planID, Number: k + 1, Count: in.Count},
			})
		}
		created, err = s.insert(ctx, r, domain.Transaction{
			UserID: userID, Date: in.Date, Description: in.Description, PayeeID: in.PayeeID, Tags: in.Tags, Postings: postings,
		})
		if err != nil {
			return err
		}
		return r.InsertPlan(ctx, domain.InstallmentPlan{
			ID: planID, UserID: userID, AccountID: card.ID, OriginTransactionID: created.ID, Kind: domain.PlanPurchase,
			Count: in.Count, Principal: principal, Interest: interest, FirstStatementID: firstCardStatement(created, card.ID),
		})
	})
	return created, planID, err
}

func purchaseTotals(c money.Currency, in InstallmentPurchaseInput) (principal, interest money.Money, err error) {
	principal, _ = money.New(0, c)
	for i, sp := range in.Splits {
		if sp.Amount.Currency() != c || sp.Amount.Amount() <= 0 {
			return money.Money{}, money.Money{}, validationError(fmt.Sprintf("splits[%d].amount", i), "must be positive and in the card currency")
		}
		if principal, err = principal.Add(sp.Amount); err != nil {
			return money.Money{}, money.Money{}, validationError("splits", err.Error())
		}
	}
	interest, _ = money.New(0, c)
	if in.Interest != nil {
		if in.Interest.Currency() != c || in.Interest.IsNegative() {
			return money.Money{}, money.Money{}, validationError("interest", "must not be negative and in the card currency")
		}
		interest = *in.Interest
	}
	return principal, interest, nil
}

func installmentParts(total money.Money, in InstallmentPurchaseInput) ([]money.Money, error) {
	if len(in.Amounts) == 0 {
		return domain.SplitInstallments(total, in.Count), nil
	}
	if len(in.Amounts) != in.Count {
		return nil, validationError("installment_amounts", "must have one amount per installment")
	}
	var sum int64
	for _, a := range in.Amounts {
		if a.Currency() != total.Currency() || a.Amount() <= 0 {
			return nil, validationError("installment_amounts", "amounts must be positive and in the card currency")
		}
		sum += a.Amount()
	}
	if sum != total.Amount() {
		return nil, validationError("installment_amounts", fmt.Sprintf("sum to %d instead of %d", sum, total.Amount()))
	}
	return in.Amounts, nil
}

func (s *Service) firstStatement(ctx context.Context, r Repository, userID int64, cardID uuid.UUID, in InstallmentPurchaseInput) (domain.ReferenceMonth, error) {
	if in.FirstStatement != nil {
		return *in.FirstStatement, nil
	}
	rules, err := r.BillingRules(ctx, userID, cardID)
	if err != nil {
		return domain.ReferenceMonth{}, err
	}
	first, err := domain.StatementFor(in.Date, rules)
	if err != nil {
		return domain.ReferenceMonth{}, validationError("card_account_id", "card has no billing cycle rule for the date")
	}
	return first, nil
}

func firstCardStatement(t domain.Transaction, cardID uuid.UUID) uuid.UUID {
	for _, p := range t.Postings {
		if p.AccountID == cardID && p.Installment != nil && p.Installment.Number == 1 {
			return p.StatementID
		}
	}
	return uuid.Nil
}

// Commitment is the sum of installments billed on the statement of month that has not closed yet.
func (s *Service) Commitment(ctx context.Context, userID int64, accountID uuid.UUID, month domain.ReferenceMonth) (money.Money, error) {
	a, err := s.card(ctx, userID, accountID)
	if err != nil {
		return money.Money{}, err
	}
	total, err := s.repo.CommittedInstallments(ctx, userID, accountID, month, s.clock.Today())
	if err != nil {
		return money.Money{}, err
	}
	return money.New(total, a.Instrument)
}

// statementView loads a statement with its derived summary inside r.
func (s *Service) statementView(ctx context.Context, r Repository, userID int64, statementID uuid.UUID) (StatementView, domain.Account, error) {
	accountID, err := r.StatementAccount(ctx, userID, statementID)
	if err != nil {
		return StatementView{}, domain.Account{}, err
	}
	card, err := r.Account(ctx, userID, accountID)
	if err != nil {
		return StatementView{}, domain.Account{}, err
	}
	views, err := s.statementSummaries(ctx, r, userID, accountID)
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

// PayStatement moves amount from a balance account to the card, billed on the statement (M08).
func (s *Service) PayStatement(ctx context.Context, userID int64, statementID uuid.UUID, date time.Time, from uuid.UUID, amount money.Money) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		v, card, err := s.statementView(ctx, r, userID, statementID)
		if err != nil {
			return err
		}
		if amount.Amount() <= 0 {
			return validationError("amount", "must be positive")
		}
		ref := v.Input.Reference
		created, err = s.insert(ctx, r, domain.Transaction{
			UserID: userID, Date: date, Description: "Statement payment " + ref.String(),
			Postings: []domain.Posting{
				{AccountID: card.ID, Amount: amount, CardRole: domain.RolePayment, Statement: &ref},
				{AccountID: from, Amount: amount.Neg()},
			},
		})
		return err
	})
	return created, err
}

// FinanceStatement converts the unpaid amount of a closed statement into installments on
// the following statements; interest is the installments' total minus the unpaid amount (S11).
func (s *Service) FinanceStatement(ctx context.Context, userID int64, statementID uuid.UUID, date time.Time, count int, installment money.Money) (domain.Transaction, uuid.UUID, error) {
	if count < 2 || count > maxInstallments {
		return domain.Transaction{}, uuid.Nil, validationError("installment_count", "must be between 2 and 420")
	}
	var created domain.Transaction
	planID := uuid.Must(uuid.NewV7())
	err := s.repo.InTx(ctx, func(r Repository) error {
		v, card, err := s.statementView(ctx, r, userID, statementID)
		if err != nil {
			return err
		}
		switch {
		case v.FinancedBy != uuid.Nil:
			return ErrStatementFinanced
		case s.clock.Today().Before(v.Input.Closing):
			return ErrStatementNotClosed
		case v.Summary.Unpaid <= 0:
			return validationError("statement", "has no unpaid amount")
		case installment.Currency() != card.Instrument || installment.Amount() <= 0:
			return validationError("installment_amount", "must be positive and in the card currency")
		}
		unpaid, err := money.New(v.Summary.Unpaid, card.Instrument)
		if err != nil {
			return err
		}
		interest, err := money.New(installment.Amount()*int64(count)-unpaid.Amount(), card.Instrument)
		if err != nil || interest.IsNegative() {
			return validationError("installment_amount", "installments must cover the unpaid amount")
		}
		ref := v.Input.Reference
		postings := []domain.Posting{{AccountID: card.ID, Amount: unpaid, CardRole: domain.RolePayment, Statement: &ref}}
		for k := 1; k <= count; k++ {
			next := ref.Add(k)
			postings = append(postings, domain.Posting{
				AccountID: card.ID, Amount: installment.Neg(), CardRole: domain.RoleCharge, Statement: &next,
				Installment: &domain.InstallmentRef{PlanID: planID, Number: k, Count: count},
			})
		}
		if !interest.IsZero() {
			interestAccount, err := r.SystemAccount(ctx, userID, domain.RoleInterest)
			if err != nil {
				return err
			}
			postings = append(postings, domain.Posting{AccountID: interestAccount.ID, Amount: interest})
		}
		created, err = s.insert(ctx, r, domain.Transaction{
			UserID: userID, Date: date, Description: "Statement financing " + ref.String(), Postings: postings,
		})
		if err != nil {
			return err
		}
		if err := r.InsertPlan(ctx, domain.InstallmentPlan{
			ID: planID, UserID: userID, AccountID: card.ID, OriginTransactionID: created.ID, Kind: domain.PlanFinancing,
			Count: count, Principal: unpaid, Interest: interest, FirstStatementID: firstCardStatement(created, card.ID),
		}); err != nil {
			return err
		}
		return r.SetStatementFinanced(ctx, statementID, planID)
	})
	return created, planID, err
}
