package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
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
	Origin         domain.Origin // manual when empty
	// Record links an external record to installment RecordNumber (P6 A40).
	Record       uuid.UUID
	RecordNumber int
}

const maxInstallments = 420

func validationError(field, message string) error {
	return &domain.FieldError{Field: field, Message: message, Err: domain.ErrValidation}
}

// InstallmentPurchase records the full expense now and one card charge per statement (S06, S07, DM2, DM3).
func (s *Service) InstallmentPurchase(
	ctx context.Context,
	booksID int64,
	in InstallmentPurchaseInput,
) (domain.Transaction, uuid.UUID, error) {
	var (
		created domain.Transaction
		planID  uuid.UUID
	)
	err := s.repo.InTx(ctx, func(r Repository) error {
		var err error
		created, planID, err = s.installmentPurchase(ctx, r, booksID, in)

		return err
	})

	return created, planID, err
}

// installmentPurchase records the purchase and its plan inside the caller's database transaction.
func (s *Service) installmentPurchase(
	ctx context.Context,
	r Repository,
	booksID int64,
	in InstallmentPurchaseInput,
) (domain.Transaction, uuid.UUID, error) {
	if err := checkInstallmentInput(in); err != nil {
		return domain.Transaction{}, uuid.Nil, err
	}

	planID := uuid.Must(uuid.NewV7())

	card, err := s.loadPurchaseCard(ctx, r, booksID, in)
	if err != nil {
		return domain.Transaction{}, uuid.Nil, err
	}

	principal, interest, parts, err := purchaseBreakdown(card, in)
	if err != nil {
		return domain.Transaction{}, uuid.Nil, err
	}

	first, err := s.firstStatement(ctx, r, booksID, card.ID, in)
	if err != nil {
		return domain.Transaction{}, uuid.Nil, err
	}

	postings, err := s.installmentPostings(
		ctx,
		r,
		booksID,
		card,
		in,
		planID,
		first,
		interest,
		parts,
	)
	if err != nil {
		return domain.Transaction{}, uuid.Nil, err
	}

	created, err := s.insert(ctx, r, domain.Transaction{
		BooksID:     booksID,
		Date:        in.Date,
		Description: in.Description,
		PayeeID:     in.PayeeID,
		Tags:        in.Tags,
		Postings:    postings,
		Origin:      in.Origin,
	})
	if err != nil {
		return domain.Transaction{}, uuid.Nil, err
	}

	if err := r.InsertPlan(ctx, domain.InstallmentPlan{
		ID:                  planID,
		BooksID:             booksID,
		AccountID:           card.ID,
		OriginTransactionID: created.ID,
		Kind:                domain.PlanPurchase,
		Count:               in.Count,
		Principal:           principal,
		Interest:            interest,
		FirstStatementID:    firstCardStatement(created, card.ID),
	}); err != nil {
		return domain.Transaction{}, uuid.Nil, err
	}

	return created, planID, nil
}

// checkInstallmentInput validates the count and the splits of a purchase.
func checkInstallmentInput(in InstallmentPurchaseInput) error {
	if in.Count < 2 || in.Count > maxInstallments {
		return validationError("installment_count", "must be between 2 and 420")
	}

	if len(in.Splits) == 0 {
		return validationError("splits", "at least one split is required")
	}

	return nil
}

// loadPurchaseCard loads the card account of a purchase and requires a credit card.
func (s *Service) loadPurchaseCard(
	ctx context.Context,
	r Repository,
	booksID int64,
	in InstallmentPurchaseInput,
) (domain.Account, error) {
	card, err := r.Account(ctx, booksID, in.CardAccountID)
	if err != nil {
		return domain.Account{}, err
	}

	if err := domain.RequireCard(card); err != nil {
		return domain.Account{}, &domain.FieldError{
			Field:   "card_account_id",
			Message: "must be a credit card account",
			Err:     domain.ErrValidation,
		}
	}

	return card, nil
}

// purchaseBreakdown returns the principal, the interest and the parts of a purchase.
func purchaseBreakdown(
	card domain.Account,
	in InstallmentPurchaseInput,
) (principal, interest money.Money, parts []money.Money, err error) {
	principal, interest, err = purchaseTotals(card.Instrument, in)
	if err != nil {
		return principal, interest, nil, err
	}

	total, err := principal.Add(interest)
	if err != nil {
		return principal, interest, nil, err
	}

	parts, err = installmentParts(total, in)
	if err != nil {
		return principal, interest, nil, err
	}

	return principal, interest, parts, nil
}

// installmentPostings returns the splits, the interest and one card charge per part.
func (s *Service) installmentPostings(
	ctx context.Context,
	r Repository,
	booksID int64,
	card domain.Account,
	in InstallmentPurchaseInput,
	planID uuid.UUID,
	first domain.ReferenceMonth,
	interest money.Money,
	parts []money.Money,
) ([]domain.Posting, error) {
	postings := append([]domain.Posting{}, in.Splits...)
	if !interest.IsZero() {
		interestAccount, err := r.SystemAccount(ctx, booksID, domain.RoleInterest)
		if err != nil {
			return nil, err
		}

		postings = append(postings, domain.Posting{AccountID: interestAccount.ID, Amount: interest})
	}

	for k, part := range parts {
		ref := domain.InstallmentStatement(first, k+1)

		p := domain.Posting{
			AccountID: card.ID, Amount: part.Neg(), CardRole: domain.RoleCharge, Statement: &ref,
			Installment: &domain.InstallmentRef{PlanID: planID, Number: k + 1, Count: in.Count},
		}
		if k+1 == in.RecordNumber {
			p.ExternalRecordID = in.Record
		}

		postings = append(postings, p)
	}

	return postings, nil
}

func purchaseTotals(
	c money.Currency,
	in InstallmentPurchaseInput,
) (principal, interest money.Money, err error) {
	principal, _ = money.New(0, c)
	for i, sp := range in.Splits {
		if sp.Amount.Currency() != c || sp.Amount.Amount() <= 0 {
			return money.Money{}, money.Money{}, validationError(
				fmt.Sprintf("splits[%d].amount", i),
				"must be positive and in the card currency",
			)
		}

		if principal, err = principal.Add(sp.Amount); err != nil {
			return money.Money{}, money.Money{}, validationError("splits", err.Error())
		}
	}

	interest, _ = money.New(0, c)
	if in.Interest != nil {
		if in.Interest.Currency() != c || in.Interest.IsNegative() {
			return money.Money{}, money.Money{}, validationError(
				"interest",
				"must not be negative and in the card currency",
			)
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
			return nil, validationError(
				"installment_amounts",
				"amounts must be positive and in the card currency",
			)
		}

		sum += a.Amount()
	}

	if sum != total.Amount() {
		return nil, validationError(
			"installment_amounts",
			fmt.Sprintf("sum to %d instead of %d", sum, total.Amount()),
		)
	}

	return in.Amounts, nil
}

func (s *Service) firstStatement(
	ctx context.Context,
	r Repository,
	booksID int64,
	cardID uuid.UUID,
	in InstallmentPurchaseInput,
) (domain.ReferenceMonth, error) {
	if in.FirstStatement != nil {
		return *in.FirstStatement, nil
	}

	rules, err := r.BillingRules(ctx, booksID, cardID)
	if err != nil {
		return domain.ReferenceMonth{}, err
	}

	first, err := domain.StatementFor(in.Date, rules)
	if err != nil {
		return domain.ReferenceMonth{}, validationError(
			"card_account_id",
			"card has no billing cycle rule for the date",
		)
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
func (s *Service) Commitment(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	month domain.ReferenceMonth,
) (money.Money, error) {
	a, err := s.card(ctx, booksID, accountID)
	if err != nil {
		return money.Money{}, err
	}

	total, err := s.repo.CommittedInstallments(ctx, booksID, accountID, month, s.clock.Today(ctx))
	if err != nil {
		return money.Money{}, err
	}

	return money.New(total, a.Instrument)
}

// PriorInstallments sums the installments billed on the statement of month of purchases booked
// before month: the accrual view counted them in an earlier month (budget plan amendment A129).
func (s *Service) PriorInstallments(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	month domain.ReferenceMonth,
) (money.Money, error) {
	a, err := s.card(ctx, booksID, accountID)
	if err != nil {
		return money.Money{}, err
	}

	total, err := s.repo.PriorInstallments(ctx, booksID, accountID, month)
	if err != nil {
		return money.Money{}, err
	}

	return money.New(total, a.Instrument)
}
