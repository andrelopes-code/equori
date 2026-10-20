package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

const (
	EventTransactionsPaired = "ledger.transactions_paired.v1"
	reasonTransferred       = "transferred"
	pairingWindowDays       = 3
)

var ErrPairingAmbiguous = errors.New("several imported transactions can pair with this one")

// TransferRequest turns the category side of a transaction into a posting on AccountID
// (P5b amendment A28). PairWith names the pairing candidate when there are several (A29).
type TransferRequest struct {
	TransactionID   uuid.UUID
	ExpectedVersion int
	AccountID       uuid.UUID
	PairWith        uuid.UUID
	Cause           Cause
}

// TransferResult names the transaction that holds the transfer and, after pairing, the one
// that was voided.
type TransferResult struct {
	Kept, Voided uuid.UUID
}

// PairedEvent is the payload of EventTransactionsPaired: the records moved to Kept (A32).
type PairedEvent struct {
	Kept      uuid.UUID   `json:"kept_transaction_id"`
	Voided    uuid.UUID   `json:"voided_transaction_id"`
	RecordIDs []uuid.UUID `json:"record_ids"`
}

// PairingQuery selects the pairing candidates of a transaction (A29).
type PairingQuery struct {
	UserID           int64
	TransactionID    uuid.UUID
	AccountID        uuid.UUID
	Amount           int64
	From, To         time.Time
	ExcludedAccounts []uuid.UUID
}

func (s *Service) Transfer(ctx context.Context, userID int64, req TransferRequest) (TransferResult, error) {
	var res TransferResult
	err := s.repo.InTx(ctx, func(r Repository) error {
		var err error
		res, err = s.transfer(ctx, r, userID, req)
		return err
	})
	return res, err
}

func (s *Service) transfer(ctx context.Context, r Repository, userID int64, req TransferRequest) (TransferResult, error) {
	t, err := r.LockTransaction(ctx, userID, req.TransactionID)
	if err != nil {
		return TransferResult{}, err
	}
	target, accounts, err := s.transferAccounts(ctx, r, userID, req.AccountID, t)
	if err != nil {
		return TransferResult{}, err
	}
	plain, err := t.Transfer(req.ExpectedVersion, target, uuid.Nil, accounts)
	if err != nil {
		return TransferResult{}, err
	}
	candidate, err := s.pairingCandidate(ctx, r, t, plain, accounts, req)
	if err != nil {
		return TransferResult{}, err
	}
	if candidate == uuid.Nil {
		return TransferResult{Kept: t.ID}, s.saveTransfer(ctx, r, t, plain, accounts, req.Cause)
	}
	other, err := r.LockTransaction(ctx, userID, candidate)
	if err != nil {
		return TransferResult{}, err
	}
	if _, err := other.Void(s.clock.Now(), ""); err == nil {
		link := linkOn(other, target.ID)
		next, err := t.Transfer(req.ExpectedVersion, target, link, accounts)
		if err != nil {
			return TransferResult{}, err
		}
		return s.pair(ctx, r, t, next, other, accounts, link, req.Cause)
	}
	// The candidate holds a reconciled posting: it keeps the transfer and t is voided.
	own := ownAccount(t, accounts)
	if own == uuid.Nil {
		return TransferResult{}, domain.ErrReconciled
	}
	if _, err := t.Void(s.clock.Now(), ""); err != nil {
		return TransferResult{}, err
	}
	ownAcc, otherAccounts, err := s.transferAccounts(ctx, r, userID, own, other)
	if err != nil {
		return TransferResult{}, err
	}
	link := linkOn(t, own)
	next, err := other.Transfer(other.Version, ownAcc, link, otherAccounts)
	if err != nil {
		return TransferResult{}, err
	}
	return s.pair(ctx, r, other, next, t, otherAccounts, link, req.Cause)
}

// transferAccounts loads the target account and the accounts of t with it.
func (s *Service) transferAccounts(ctx context.Context, r Repository, userID int64, accountID uuid.UUID, t domain.Transaction) (domain.Account, map[uuid.UUID]domain.Account, error) {
	accounts, err := r.Accounts(ctx, userID, append(postingAccounts(t), accountID))
	if err != nil {
		return domain.Account{}, nil, err
	}
	return accounts[accountID], accounts, nil
}

// pairingCandidate returns the transaction to pair with, or uuid.Nil without candidates.
func (s *Service) pairingCandidate(ctx context.Context, r Repository, t, plain domain.Transaction, accounts map[uuid.UUID]domain.Account, req TransferRequest) (uuid.UUID, error) {
	q := PairingQuery{
		UserID: t.UserID, TransactionID: t.ID, AccountID: req.AccountID, Amount: plain.Postings[len(plain.Postings)-1].Amount.Amount(),
		From: t.Date.AddDate(0, 0, -pairingWindowDays), To: t.Date.AddDate(0, 0, pairingWindowDays),
	}
	for _, p := range t.Postings {
		if !accounts[p.AccountID].IsReplaceable() {
			q.ExcludedAccounts = append(q.ExcludedAccounts, p.AccountID)
		}
	}
	ids, err := r.PairingCandidates(ctx, q)
	switch {
	case err != nil:
		return uuid.Nil, err
	case req.PairWith != uuid.Nil:
		if !slices.Contains(ids, req.PairWith) {
			return uuid.Nil, &domain.FieldError{Field: "pair_with", Message: "is not a pairing candidate", Err: domain.ErrValidation}
		}
		return req.PairWith, nil
	case len(ids) > 1:
		return uuid.Nil, ErrPairingAmbiguous
	case len(ids) == 1:
		return ids[0], nil
	}
	return uuid.Nil, nil
}

// pair voids dropped, moves its record link to kept's new posting and stores kept's transfer.
func (s *Service) pair(ctx context.Context, r Repository, kept, next, dropped domain.Transaction, accounts map[uuid.UUID]domain.Account, link uuid.UUID, cause Cause) (TransferResult, error) {
	voided, err := dropped.Void(s.clock.Now(), "paired with "+kept.ID.String())
	if err != nil {
		return TransferResult{}, err
	}
	if err := r.ClearRecordLinks(ctx, dropped.UserID, dropped.ID); err != nil {
		return TransferResult{}, err
	}
	if err := r.VoidTransaction(ctx, voided); err != nil {
		return TransferResult{}, err
	}
	droppedAccounts, err := r.Accounts(ctx, dropped.UserID, postingAccounts(dropped))
	if err != nil {
		return TransferResult{}, err
	}
	if err := r.Publish(ctx, outbox.Event{
		Type: EventTransactionVoided, UserID: dropped.UserID, AggregateID: dropped.ID.String(), Payload: newTransactionEvent(voided, droppedAccounts),
	}); err != nil {
		return TransferResult{}, err
	}
	if err := s.saveTransfer(ctx, r, kept, next, accounts, cause); err != nil {
		return TransferResult{}, err
	}
	var records []uuid.UUID
	if link != uuid.Nil {
		records = []uuid.UUID{link}
	}
	return TransferResult{Kept: kept.ID, Voided: dropped.ID}, r.Publish(ctx, outbox.Event{
		Type: EventTransactionsPaired, UserID: kept.UserID, AggregateID: kept.ID.String(),
		Payload: PairedEvent{Kept: kept.ID, Voided: dropped.ID, RecordIDs: records},
	})
}

func (s *Service) saveTransfer(ctx context.Context, r Repository, prev, next domain.Transaction, accounts map[uuid.UUID]domain.Account, cause Cause) error {
	if err := s.bill(ctx, r, &next); err != nil {
		return err
	}
	if err := r.ReplaceCategoryPostings(ctx, prev, next, reasonTransferred); err != nil {
		return err
	}
	event := newTransactionEvent(next, accounts, prev)
	event.PreviousDate = prev.Date.Format(time.DateOnly)
	event.CategoriesChanged = true
	if cause.Method != "" {
		event.Cause = &cause
	}
	return r.Publish(ctx, outbox.Event{Type: EventTransactionCorrected, UserID: next.UserID, AggregateID: next.ID.String(), Payload: event})
}

// linkOn returns the record that confirms t's posting on the account.
func linkOn(t domain.Transaction, accountID uuid.UUID) uuid.UUID {
	for _, p := range t.Postings {
		if p.AccountID == accountID && p.ExternalRecordID != uuid.Nil {
			return p.ExternalRecordID
		}
	}
	return uuid.Nil
}

// ownAccount returns the only balance-sheet account of t, or uuid.Nil.
func ownAccount(t domain.Transaction, accounts map[uuid.UUID]domain.Account) uuid.UUID {
	var own []uuid.UUID
	for _, p := range t.Postings {
		if !accounts[p.AccountID].IsReplaceable() && !slices.Contains(own, p.AccountID) {
			own = append(own, p.AccountID)
		}
	}
	if len(own) != 1 {
		return uuid.Nil
	}
	return own[0]
}
