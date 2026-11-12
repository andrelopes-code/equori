package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// ErrInstallmentUnavailable: the installment does not exist, or its purchase was voided,
// refunded or cancelled, so a statement line cannot confirm it.
var ErrInstallmentUnavailable = errors.New("the installment cannot take the line")

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
	// Total is the purchase total the source reports; it is used when its split (5.2.5)
	// gives the line its own amount (A90).
	Total    *money.Money
	Decision *ImportDecision
}

// RecordImportedInstallment creates the installment purchase of a line: Count installments of
// Amount from the statement Number − 1 months before the line's, with the line confirming
// its installment. A record that a posting already carries keeps it, so an interrupted
// sync completes without a second plan.
func (s *Service) RecordImportedInstallment(
	ctx context.Context,
	booksID int64,
	in ImportedInstallment,
) (txID, planID uuid.UUID, err error) {
	if txID, planID, err := s.repo.RecordPosting(
		ctx,
		booksID,
		in.RecordID,
	); !errors.Is(
		err,
		ErrNotFound,
	) {
		return txID, planID, err
	}

	line, err := s.lineStatement(ctx, booksID, in)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}

	first := line.Add(1 - in.Number)

	total, err := importedInstallmentTotal(in)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}

	expense, err := s.repo.SystemAccount(ctx, booksID, domain.RoleUncategorizedExpense)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}

	purchase := importedPurchase(in, first, total, expense.ID)
	t, planID, err := s.InstallmentPurchase(ctx, booksID, purchase)

	return t.ID, planID, err
}

// importedInstallmentTotal is the purchase total of the line: Count times its installment, or
// the reported total when it splits into that installment at the line's number.
func importedInstallmentTotal(in ImportedInstallment) (money.Money, error) {
	total, err := money.New(in.Amount.Amount()*int64(in.Count), in.Amount.Currency())
	if err != nil {
		return money.Money{}, err
	}

	if t := in.Total; t != nil && t.Currency() == in.Amount.Currency() && in.Number <= in.Count {
		if parts := domain.SplitInstallments(*t, in.Count); parts[in.Number-1] == in.Amount {
			total = *t
		}
	}

	return total, nil
}

// importedPurchase is the installment purchase of the line, with its single split.
func importedPurchase(
	in ImportedInstallment,
	first domain.ReferenceMonth,
	total money.Money,
	expenseID uuid.UUID,
) InstallmentPurchaseInput {
	split := domain.Posting{AccountID: expenseID, Amount: total}

	purchase := InstallmentPurchaseInput{
		CardAccountID:  in.CardAccountID,
		Date:           in.PurchaseDate,
		Description:    in.Description,
		Count:          in.Count,
		FirstStatement: &first,
		Origin:         domain.OriginImport,
		Record:         in.RecordID,
		RecordNumber:   in.Number,
	}
	if d := in.Decision; d != nil {
		purchase.PayeeID, purchase.Tags = d.PayeeID, d.AddTags
		// One decided category takes the whole purchase; a split decision stays uncategorized.
		if len(d.Parts) == 1 {
			split.AccountID = d.Parts[0].AccountID
		}
	}

	purchase.Splits = []domain.Posting{split}

	return purchase
}

func (s *Service) lineStatement(
	ctx context.Context,
	booksID int64,
	in ImportedInstallment,
) (domain.ReferenceMonth, error) {
	if in.DueDate != nil {
		return s.statementDue(ctx, s.repo, booksID, in.CardAccountID, *in.DueDate)
	}

	rules, err := s.repo.BillingRules(ctx, booksID, in.CardAccountID)
	if err != nil {
		return domain.ReferenceMonth{}, err
	}

	ref, err := s.statementOn(ctx, s.repo, booksID, in.CardAccountID, in.LineDate, rules)
	if errors.Is(err, domain.ErrNoBillingRule) {
		return domain.ReferenceMonth{}, validationError(
			"card_account_id",
			"card has no billing cycle rule for the date",
		)
	}

	return ref, err
}

// PlanInstallmentState is one installment posting of a plan.
type PlanInstallmentState struct {
	PostingID, TransactionID uuid.UUID
	Amount                   int64
	RecordID                 uuid.UUID
	Reversed                 bool
}

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
func (s *Service) InstallmentPlan(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (PlanView, error) {
	plan, err := s.repo.Plan(ctx, booksID, id)
	if err != nil {
		return PlanView{}, err
	}

	installments, err := s.repo.PlanInstallments(ctx, booksID, id)
	if err != nil {
		return PlanView{}, err
	}

	cancelled, anticipated, err := s.repo.PlanState(ctx, booksID, plan.OriginTransactionID)
	if err != nil {
		return PlanView{}, err
	}

	var credited map[domain.ReferenceMonth]struct{}
	if anticipated && !cancelled {
		if credited, err = s.repo.AnticipatedReferences(
			ctx,
			booksID,
			plan.OriginTransactionID,
		); err != nil {
			return PlanView{}, err
		}
	}

	view := PlanView{
		Plan:         plan,
		Status:       "active",
		Installments: make([]ScheduledInstallment, len(installments)),
	}
	switch {
	case cancelled:
		view.Status = "cancelled"
	case anticipated:
		view.Status = "anticipated"
	}

	for i, in := range installments {
		_, anticipatedHere := credited[in.Reference]
		view.Installments[i] = ScheduledInstallment{
			Number:    in.Number,
			Reference: in.Reference,
			Amount:    -in.Amount,
			Reversed:  cancelled || anticipatedHere,
		}
	}

	return view, nil
}

// rewriteInstallment replaces the installment k of prev by the confirmed record and publishes
// the corrected transaction.
func (s *Service) rewriteInstallment(
	ctx context.Context,
	r Repository,
	booksID int64,
	prev domain.Transaction,
	k int,
	recordID uuid.UUID,
	number int,
	amount money.Money,
	ref domain.ReferenceMonth,
	status domain.PostingStatus,
) error {
	next, err := withConfirmedInstallment(prev, k, recordID, number, amount, ref, status)
	if err != nil {
		return err
	}

	accounts, err := r.Accounts(ctx, booksID, postingAccounts(prev))
	if err != nil {
		return err
	}

	if next, err = domain.NewTransaction(next, accounts); err != nil {
		return err
	}

	if err := s.bill(ctx, r, &next); err != nil {
		return err
	}

	if err := r.ReplaceCategoryPostings(ctx, prev, next, reasonConfirmed); err != nil {
		return err
	}

	event := newTransactionEvent(next, accounts, prev)
	event.PreviousDate = prev.Date.Format(time.DateOnly)

	return r.Publish(
		ctx,
		outbox.Event{
			Type:        EventTransactionCorrected,
			BooksID:     booksID,
			AggregateID: next.ID.String(),
			Payload:     event,
		},
	)
}

// absorbInstallmentDelta adds delta to the first category posting of postings.
func absorbInstallmentDelta(postings []domain.Posting, delta int64) error {
	for i := range postings {
		p := &postings[i]
		if p.CardRole != "" {
			continue
		}

		if p.Status == domain.StatusReconciled {
			return ErrInstallmentUnavailable
		}

		changed, err := money.New(p.Amount.Amount()+delta, p.Amount.Currency())
		if err != nil {
			return err
		}

		p.ID, p.Amount, p.Weight = uuid.Nil, changed, money.Money{}

		return nil
	}

	return ErrInstallmentUnavailable
}
