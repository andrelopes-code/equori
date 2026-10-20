package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
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
	if t := in.Total; t != nil && t.Currency() == in.Amount.Currency() && in.Number <= in.Count {
		if parts := domain.SplitInstallments(*t, in.Count); parts[in.Number-1] == in.Amount {
			total = *t
		}
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
	ref, err := s.statementOn(ctx, s.repo, userID, in.CardAccountID, in.LineDate, rules)
	if errors.Is(err, domain.ErrNoBillingRule) {
		return domain.ReferenceMonth{}, validationError("card_account_id", "card has no billing cycle rule for the date")
	}
	return ref, err
}

// InstallmentConfirmation is what an aggregator line reports about the installment it
// confirms (A90).
type InstallmentConfirmation struct {
	Amount  money.Money // one installment, positive
	DueDate *time.Time  // the line's bill; nil keeps the installment's statement
	Pending bool        // the institution has not billed the line yet
}

// LinkInstallment links a line to installment number of a plan and returns its transaction.
// The line sets the installment's amount and, with a bill, its statement; later installments
// no line confirms follow it month by month (A90). ErrInstallmentUnavailable when the
// installment is gone, its purchase was reversed, or a change would touch a reconciled
// posting; ErrAlreadyMatched when another record confirms it. Linking the same record again
// is a no-op.
func (s *Service) LinkInstallment(ctx context.Context, userID int64, recordID, planID uuid.UUID, number int, c InstallmentConfirmation) (uuid.UUID, error) {
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
		}
		txID = in.TransactionID
		return s.confirmInstallment(ctx, r, userID, in, recordID, number, c)
	})
	return txID, err
}

// confirmInstallment writes what the line reports on installment number: the record link,
// and a new version of the purchase when the amount or the statement differs.
func (s *Service) confirmInstallment(ctx context.Context, r Repository, userID int64, in PlanInstallmentState, recordID uuid.UUID, number int, c InstallmentConfirmation) error {
	prev, err := r.LockTransaction(ctx, userID, in.TransactionID)
	if err != nil {
		return err
	}
	k := slices.IndexFunc(prev.Postings, func(p domain.Posting) bool { return p.ID == in.PostingID })
	if k < 0 {
		return ErrInstallmentUnavailable
	}
	target := prev.Postings[k].Statement
	if c.DueDate != nil {
		ref, err := s.statementDue(ctx, r, userID, prev.Postings[k].AccountID, *c.DueDate)
		if err != nil {
			return err
		}
		target = &ref
	}
	status := prev.Postings[k].Status
	if c.Pending {
		status = domain.StatusPending
	}
	if -in.Amount == c.Amount.Amount() && target != nil && prev.Postings[k].Statement != nil && *target == *prev.Postings[k].Statement {
		if err := r.LinkExternalRecord(ctx, userID, in.PostingID, recordID); err != nil {
			return err
		}
		if status == prev.Postings[k].Status {
			return nil
		}
		return r.SettleImportedPosting(ctx, userID, in.PostingID, status, uuid.Nil)
	}
	next, err := withConfirmedInstallment(prev, k, recordID, number, c.Amount, *target, status)
	if err != nil {
		return err
	}
	accounts, err := r.Accounts(ctx, userID, postingAccounts(prev))
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
	return r.Publish(ctx, outbox.Event{Type: EventTransactionCorrected, UserID: userID, AggregateID: next.ID.String(), Payload: event})
}

const reasonConfirmed = "installment confirmed"

// withConfirmedInstallment returns the next version of the purchase: posting k confirmed by
// the record with amount and statement ref, the later unconfirmed installments of its plan on
// ref's following months, and the first category posting taking the difference of the total.
func withConfirmedInstallment(prev domain.Transaction, k int, recordID uuid.UUID, number int, amount money.Money, ref domain.ReferenceMonth, status domain.PostingStatus) (domain.Transaction, error) {
	next := prev
	next.Postings = slices.Clone(prev.Postings)
	next.Version++
	plan := next.Postings[k].Installment.PlanID
	delta := next.Postings[k].Amount.Amount() + amount.Amount() // the card side grows by −delta
	for i := range next.Postings {
		p := &next.Postings[i]
		moved := i == k
		if inst := p.Installment; !moved && inst != nil && inst.PlanID == plan && inst.Number > number && p.ExternalRecordID == uuid.Nil {
			later := ref.Add(inst.Number - number)
			moved = p.Statement == nil || *p.Statement != later
			p.Statement = &later
		}
		if i == k {
			p.Amount, p.Weight, p.ExternalRecordID, p.Statement, p.Status = amount.Neg(), money.Money{}, recordID, &ref, status
		}
		if !moved {
			continue
		}
		if p.Status == domain.StatusReconciled {
			return domain.Transaction{}, ErrInstallmentUnavailable
		}
		p.ID, p.StatementID = uuid.Nil, uuid.Nil
	}
	if delta == 0 {
		return next, nil
	}
	for i := range next.Postings {
		p := &next.Postings[i]
		if p.CardRole != "" {
			continue
		}
		if p.Status == domain.StatusReconciled {
			return domain.Transaction{}, ErrInstallmentUnavailable
		}
		changed, err := money.New(p.Amount.Amount()+delta, p.Amount.Currency())
		if err != nil {
			return domain.Transaction{}, err
		}
		p.ID, p.Amount, p.Weight = uuid.Nil, changed, money.Money{}
		return next, nil
	}
	return domain.Transaction{}, ErrInstallmentUnavailable
}

// PlanInstallmentState is one installment posting of a plan.
type PlanInstallmentState struct {
	PostingID, TransactionID uuid.UUID
	Amount                   int64
	RecordID                 uuid.UUID
	Reversed                 bool
}
