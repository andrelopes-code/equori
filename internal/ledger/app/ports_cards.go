package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

// cardStore holds the Repository methods of cards, statements, installment plans, reimbursements and disputes.
type cardStore interface {
	SaveBillingRule(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		r domain.BillingCycleRule,
	) (domain.BillingCycleRule, error)
	BillingRules(ctx context.Context, booksID int64, accountID uuid.UUID) (domain.Rules, error)
	InsertCreditLimit(ctx context.Context, booksID int64, l CreditLimit) (CreditLimit, error)
	CreditLimits(ctx context.Context, booksID int64, accountID uuid.UUID) ([]CreditLimit, error)
	InsertCard(ctx context.Context, c domain.Card) (domain.Card, error)
	Cards(ctx context.Context, booksID int64, accountID uuid.UUID) ([]domain.Card, error)
	UpdateCard(
		ctx context.Context,
		booksID int64,
		id uuid.UUID,
		e domain.CardEdit,
	) (domain.Card, error)
	DeleteCard(ctx context.Context, booksID int64, id uuid.UUID) error

	EnsureStatement(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		d domain.StatementDates,
		due time.Time,
	) (uuid.UUID, error)
	Statements(ctx context.Context, booksID int64, accountID uuid.UUID) ([]Statement, error)
	// HasOpeningBalance reports whether a transaction not voided books the account against
	// the opening balances account.
	HasOpeningBalance(ctx context.Context, booksID int64, accountID uuid.UUID) (bool, error)
	// StatementClosings returns the closing date of each stored statement of the card.
	StatementClosings(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
	) (map[domain.ReferenceMonth]time.Time, error)
	// SaveStatementFact records a fact, replacing the one of its source (A85).
	SaveStatementFact(ctx context.Context, f domain.StatementFact) error
	DeleteStatementFact(
		ctx context.Context,
		booksID int64,
		statementID uuid.UUID,
		source string,
	) error
	// RedatablePostings lists the card's postings billed by their date (A86).
	RedatablePostings(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
	) ([]RedatablePosting, error)
	MovePostingStatement(ctx context.Context, booksID int64, postingID, statementID uuid.UUID) error
	StatementAccount(ctx context.Context, booksID int64, statementID uuid.UUID) (uuid.UUID, error)
	UpdateStatementDates(ctx context.Context, id uuid.UUID, closing, due time.Time) error
	InsertPlan(ctx context.Context, p domain.InstallmentPlan) error
	SetStatementFinanced(ctx context.Context, statementID, planID uuid.UUID) error
	Plan(ctx context.Context, booksID int64, id uuid.UUID) (domain.InstallmentPlan, error)
	PlanInstallments(
		ctx context.Context,
		booksID int64,
		planID uuid.UUID,
	) ([]PlanInstallment, error)
	// PlanState reports whether a non-voided cancellation or anticipation of the origin purchase exists.
	PlanState(
		ctx context.Context,
		booksID int64,
		originID uuid.UUID,
	) (cancelled, anticipated bool, err error)
	// AnticipatedReferences returns the statements credited by non-voided anticipations of the origin purchase.
	AnticipatedReferences(
		ctx context.Context,
		booksID int64,
		originID uuid.UUID,
	) (map[domain.ReferenceMonth]struct{}, error)
	RefundedTotal(ctx context.Context, booksID int64, originID uuid.UUID) (int64, error)
	// AnticipationCharges returns the charges of non-voided anticipations of the origin purchase, without installment numbers (A135).
	AnticipationCharges(
		ctx context.Context,
		booksID int64,
		originID uuid.UUID,
	) ([]PlanInstallment, error)
	// AnticipationDiscount returns the discount non-voided anticipations of the origin purchase granted, positive (A135).
	AnticipationDiscount(ctx context.Context, booksID int64, originID uuid.UUID) (int64, error)
	// ReimbursedTotal returns what the non-voided transactions other than exceptFrom repay of the origin expense (A117).
	ReimbursedTotal(
		ctx context.Context,
		booksID int64,
		originID, exceptFrom uuid.UUID,
	) (int64, error)
	// ReimbursementCandidates returns the expenses with an amount left to reimburse, ranked as the query asks (A117).
	ReimbursementCandidates(ctx context.Context, q CandidateQuery) ([]CandidateRow, error)
	// ReimbursementSources returns the inflows that can repay an expense, oldest first (A117).
	ReimbursementSources(ctx context.Context, q SourceQuery) ([]SourceRow, error)
	// SetReimbursementLinks replaces the reimbursement_of links of a transaction with links (A117).
	SetReimbursementLinks(
		ctx context.Context,
		booksID int64,
		from uuid.UUID,
		links []domain.Link,
	) error
	InsertDispute(ctx context.Context, d Dispute) (Dispute, error)
	Disputes(ctx context.Context, booksID int64, transactionID uuid.UUID) ([]Dispute, error)
	// LinksTo returns the non-voided transactions that link to id, ordered by link type, then source.
	LinksTo(ctx context.Context, booksID int64, id uuid.UUID) ([]Reference, error)
	LockDispute(ctx context.Context, booksID int64, id uuid.UUID) (Dispute, error)
	ResolveDispute(ctx context.Context, d Dispute) (Dispute, error)
	SystemAccount(
		ctx context.Context,
		booksID int64,
		role domain.SystemRole,
	) (domain.Account, error)
	CommittedInstallments(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		month domain.ReferenceMonth,
		today time.Time,
	) (int64, error)
	// PriorInstallments returns the installments billed on statement month of purchases booked
	// before it, one per charge.
	PriorInstallments(
		ctx context.Context,
		booksID int64,
		accountID uuid.UUID,
		month domain.ReferenceMonth,
	) ([]PriorInstallment, error)
	StatementPostings(
		ctx context.Context,
		booksID int64,
		statementID uuid.UUID,
	) ([]StatementPosting, error)
}
