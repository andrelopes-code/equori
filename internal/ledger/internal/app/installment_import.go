package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ErrInstallmentUnavailable: the installment does not exist, or its purchase was voided,
// refunded or cancelled, so a statement line cannot confirm it.
var ErrInstallmentUnavailable = errors.New("the installment cannot take the line")

// ErrAmountMismatch: the line's amount is not its installment's (P6 amendment A40).
var ErrAmountMismatch = errors.New("the line's amount differs from its installment")

// ImportedInstallment is the first aggregator line seen of an installment purchase (P6
// amendment A40): installment Number of Count, billed on the bill due DueDate or, without
// it, on the statement its date falls in.
type ImportedInstallment struct {
	RecordID      uuid.UUID
	CardAccountID uuid.UUID
	PurchaseDate  time.Time
	LineDate      time.Time
	DueDate       *time.Time
	Description   string
	Number, Count int
	Amount        money.Money // one installment, positive
	Decision      *ImportDecision
}

// RecordImportedInstallment creates the installment purchase of a line: Count installments of
// Amount from the statement Number − 1 months before the line's, with the line confirming
// its installment. A record that a posting already carries keeps it, so an interrupted
// sync completes without a second plan.
func (s *Service) RecordImportedInstallment(ctx context.Context, userID int64, in ImportedInstallment) (txID, planID uuid.UUID, err error) {
	if txID, planID, err := s.repo.RecordPosting(ctx, userID, in.RecordID); !errors.Is(err, ErrNotFound) {
		return txID, planID, err
	}
	line, err := s.lineStatement(ctx, userID, in)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	first := line.Add(1 - in.Number)
	total, err := money.New(in.Amount.Amount()*int64(in.Count), in.Amount.Currency())
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	expense, err := s.repo.SystemAccount(ctx, userID, domain.RoleUncategorizedExpense)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	split := domain.Posting{AccountID: expense.ID, Amount: total}
	purchase := InstallmentPurchaseInput{
		CardAccountID: in.CardAccountID, Date: in.PurchaseDate, Description: in.Description, Count: in.Count,
		FirstStatement: &first, Origin: domain.OriginImport, Record: in.RecordID, RecordNumber: in.Number,
	}
	if d := in.Decision; d != nil {
		purchase.PayeeID, purchase.Tags = d.PayeeID, d.AddTags
		// One decided category takes the whole purchase; a split decision stays uncategorized.
		if len(d.Parts) == 1 {
			split.AccountID = d.Parts[0].AccountID
		}
	}
	purchase.Splits = []domain.Posting{split}
	t, planID, err := s.InstallmentPurchase(ctx, userID, purchase)
	return t.ID, planID, err
}

func (s *Service) lineStatement(ctx context.Context, userID int64, in ImportedInstallment) (domain.ReferenceMonth, error) {
	if in.DueDate != nil {
		return s.statementDue(ctx, s.repo, userID, in.CardAccountID, *in.DueDate)
	}
	rules, err := s.repo.BillingRules(ctx, userID, in.CardAccountID)
	if err != nil {
		return domain.ReferenceMonth{}, err
	}
	ref, err := domain.StatementFor(in.LineDate, rules)
	if err != nil {
		return domain.ReferenceMonth{}, validationError("card_account_id", "card has no billing cycle rule for the date")
	}
	return ref, nil
}

// LinkInstallment links a line to installment number of a plan and returns its transaction.
// ErrInstallmentUnavailable when the installment is gone or its purchase was reversed;
// ErrAmountMismatch when the installment's amount is not the line's; ErrAlreadyMatched when
// another record confirms it. Linking the same record again is a no-op.
func (s *Service) LinkInstallment(ctx context.Context, userID int64, recordID, planID uuid.UUID, number int, amount money.Money) (uuid.UUID, error) {
	var txID uuid.UUID
	err := s.repo.InTx(ctx, func(r Repository) error {
		in, err := r.LockPlanInstallment(ctx, userID, planID, number)
		switch {
		case errors.Is(err, ErrNotFound):
			return ErrInstallmentUnavailable
		case err != nil:
			return err
		case in.Reversed:
			return ErrInstallmentUnavailable
		case in.RecordID == recordID:
			txID = in.TransactionID
			return nil
		case in.RecordID != uuid.Nil:
			return ErrAlreadyMatched
		case -in.Amount != amount.Amount():
			return ErrAmountMismatch
		}
		txID = in.TransactionID
		return r.LinkExternalRecord(ctx, userID, in.PostingID, recordID)
	})
	return txID, err
}

// PlanInstallmentState is one installment posting of a plan.
type PlanInstallmentState struct {
	PostingID, TransactionID uuid.UUID
	Amount                   int64
	RecordID                 uuid.UUID
	Reversed                 bool
}
