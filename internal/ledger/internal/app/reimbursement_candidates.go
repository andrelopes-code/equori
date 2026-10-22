package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	reimbursementWindowDays   = 90
	reimbursementCandidateMax = 15
	reimbursementSourceMax    = 10
)

// CandidateQuery selects the expenses a transaction can repay (A117).
type CandidateQuery struct {
	UserID     int64
	ExcludeID  uuid.UUID
	Instrument money.Currency
	Amount     int64
	From, To   time.Time
	MaxRows    int
}

// CandidateRow is an expense with an amount left to repay: Remaining counts the other
// transactions, Allocated is what ExcludeID repays of it.
type CandidateRow struct {
	ID                   uuid.UUID
	Remaining, Allocated int64
}

// ReimbursementCandidate is an expense a transaction can repay.
type ReimbursementCandidate struct {
	Transaction          domain.Transaction
	Remaining, Allocated money.Money
}

// categorySide returns the amount that comes in on the category side of t and its currency;
// the amount is zero for a voided transaction or an outflow.
func (s *Service) categorySide(ctx context.Context, userID int64, t domain.Transaction) (int64, money.Currency, error) {
	accounts, err := s.repo.Accounts(ctx, userID, postingAccounts(t))
	if err != nil {
		return 0, "", err
	}
	var total int64
	var instrument money.Currency
	for _, p := range t.Postings {
		if accounts[p.AccountID].IsCategory() {
			total += p.Amount.Amount()
			instrument = p.Amount.Currency()
		}
	}
	if t.VoidedAt != nil || instrument == "" || total >= 0 {
		return 0, "", nil
	}
	return -total, instrument, nil
}

// ReimbursementCandidates lists the expenses the inflow id can repay and, when a single
// combination of them adds up to the inflow, the ids of that combination (A117).
func (s *Service) ReimbursementCandidates(ctx context.Context, userID int64, id uuid.UUID) ([]ReimbursementCandidate, []uuid.UUID, error) {
	t, err := s.repo.Transaction(ctx, userID, id)
	if err != nil {
		return nil, nil, err
	}
	inflow, instrument, err := s.categorySide(ctx, userID, t)
	if err != nil || inflow == 0 {
		return []ReimbursementCandidate{}, nil, err
	}
	rows, err := s.repo.ReimbursementCandidates(ctx, CandidateQuery{
		UserID: userID, ExcludeID: t.ID, Instrument: instrument, Amount: inflow,
		From: t.Date.AddDate(0, 0, -reimbursementWindowDays), To: t.Date, MaxRows: reimbursementCandidateMax,
	})
	if err != nil {
		return nil, nil, err
	}
	byID, err := s.transactionsByID(ctx, userID, func(yield func(uuid.UUID)) {
		for _, row := range rows {
			yield(row.ID)
		}
	})
	if err != nil {
		return nil, nil, err
	}
	out := make([]ReimbursementCandidate, 0, len(rows))
	remaining := make([]int64, len(rows))
	allocated := false
	for i, row := range rows {
		rest, err := money.New(row.Remaining, instrument)
		if err != nil {
			return nil, nil, err
		}
		held, err := money.New(row.Allocated, instrument)
		if err != nil {
			return nil, nil, err
		}
		out = append(out, ReimbursementCandidate{Transaction: byID[row.ID], Remaining: rest, Allocated: held})
		remaining[i] = row.Remaining
		allocated = allocated || row.Allocated > 0
	}
	if allocated {
		return out, nil, nil
	}
	var suggestion []uuid.UUID
	if picked, ok := domain.ExactSubset(remaining, inflow); ok {
		for _, i := range picked {
			suggestion = append(suggestion, rows[i].ID)
		}
	}
	return out, suggestion, nil
}

// transactionsByID loads the transactions whose ids ids yields.
func (s *Service) transactionsByID(ctx context.Context, userID int64, ids func(yield func(uuid.UUID))) (map[uuid.UUID]domain.Transaction, error) {
	var list []uuid.UUID
	ids(func(id uuid.UUID) { list = append(list, id) })
	found, err := s.repo.TransactionsByIDs(ctx, userID, list)
	if err != nil {
		return nil, err
	}
	byID := make(map[uuid.UUID]domain.Transaction, len(found))
	for _, f := range found {
		byID[f.ID] = f
	}
	return byID, nil
}

// SourceQuery selects the inflows that can repay an expense (A117).
type SourceQuery struct {
	UserID     int64
	ExcludeID  uuid.UUID
	Instrument money.Currency
	From, To   time.Time
	MaxRows    int
}

// SourceRow is an inflow with an amount not allocated.
type SourceRow struct {
	ID   uuid.UUID
	Free int64
}

// ReimbursementSource is an inflow that can repay an expense.
type ReimbursementSource struct {
	Transaction domain.Transaction
	Free        money.Money
}

// ReimbursementSources lists the inflows that can repay the expense id (A117).
func (s *Service) ReimbursementSources(ctx context.Context, userID int64, id uuid.UUID) ([]ReimbursementSource, error) {
	t, err := s.repo.Transaction(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	accounts, err := s.repo.Accounts(ctx, userID, postingAccounts(t))
	if err != nil {
		return nil, err
	}
	var instrument money.Currency
	for _, p := range t.Postings {
		if accounts[p.AccountID].Class == domain.ClassExpense && p.Amount.Amount() > 0 {
			instrument = p.Amount.Currency()
		}
	}
	if t.VoidedAt != nil || instrument == "" {
		return []ReimbursementSource{}, nil
	}
	rows, err := s.repo.ReimbursementSources(ctx, SourceQuery{
		UserID: userID, ExcludeID: t.ID, Instrument: instrument,
		From: t.Date, To: t.Date.AddDate(0, 0, reimbursementWindowDays), MaxRows: reimbursementSourceMax,
	})
	if err != nil {
		return nil, err
	}
	byID, err := s.transactionsByID(ctx, userID, func(yield func(uuid.UUID)) {
		for _, row := range rows {
			yield(row.ID)
		}
	})
	if err != nil {
		return nil, err
	}
	out := make([]ReimbursementSource, 0, len(rows))
	for _, row := range rows {
		free, err := money.New(row.Free, instrument)
		if err != nil {
			return nil, err
		}
		out = append(out, ReimbursementSource{Transaction: byID[row.ID], Free: free})
	}
	return out, nil
}
