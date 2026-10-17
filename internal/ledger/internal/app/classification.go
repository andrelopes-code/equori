package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// FactPosting is a posting with the account attributes that classification rules read.
type FactPosting struct {
	AccountID               uuid.UUID
	Class, Kind, SystemRole string
	Amount                  money.Money
	Installment             bool
}

// TransactionFacts describes a transaction for Classification (P5 amendments A17, A26).
type TransactionFacts struct {
	ID      uuid.UUID
	Version int
	Date    time.Time
	// RawDescription is the description of version 1.
	Description, RawDescription string
	PayeeID                     uuid.UUID
	Origin                      string
	Voided                      bool
	CategoryState               string
	Postings                    []FactPosting
}

// TransactionFacts returns the facts of the user's transactions among ids, in the order of
// ids; unknown ids are omitted.
func (s *Service) TransactionFacts(ctx context.Context, userID int64, ids []uuid.UUID) ([]TransactionFacts, error) {
	ts, err := s.repo.TransactionsByIDs(ctx, userID, ids)
	if err != nil || len(ts) == 0 {
		return nil, err
	}
	raw, err := s.repo.RawDescriptions(ctx, userID, ids)
	if err != nil {
		return nil, err
	}
	accounts, err := s.repo.Accounts(ctx, userID, postingAccounts(ts...))
	if err != nil {
		return nil, err
	}
	byID := make(map[uuid.UUID]int, len(ts))
	for i, t := range ts {
		byID[t.ID] = i
	}
	out := make([]TransactionFacts, 0, len(ts))
	for _, id := range ids {
		i, ok := byID[id]
		if !ok {
			continue
		}
		t := ts[i]
		f := TransactionFacts{
			ID: t.ID, Version: t.Version, Date: t.Date, Description: t.Description, RawDescription: t.Description,
			PayeeID: t.PayeeID, Origin: string(t.Origin), Voided: t.VoidedAt != nil, CategoryState: string(t.CategoryState(accounts)),
			Postings: make([]FactPosting, len(t.Postings)),
		}
		if d, ok := raw[t.ID]; ok {
			f.RawDescription = d
		}
		for j, p := range t.Postings {
			a := accounts[p.AccountID]
			f.Postings[j] = FactPosting{
				AccountID: p.AccountID, Class: string(a.Class), Kind: string(a.Kind), SystemRole: string(a.SystemRole),
				Amount: p.Amount, Installment: p.Installment != nil,
			}
		}
		out = append(out, f)
	}
	return out, nil
}

// AccountFact is an account with the attributes that classification rules read.
type AccountFact struct {
	ID, ParentID            uuid.UUID
	Class, Kind, SystemRole string
	Instrument              money.Currency
	OpenedOn                time.Time
	ClosedOn                *time.Time
}

func (s *Service) AccountFacts(ctx context.Context, userID int64) ([]AccountFact, error) {
	as, err := s.repo.AllAccounts(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]AccountFact, len(as))
	for i, a := range as {
		out[i] = AccountFact{
			ID: a.ID, ParentID: a.ParentID, Class: string(a.Class), Kind: string(a.Kind), SystemRole: string(a.SystemRole),
			Instrument: a.Instrument, OpenedOn: a.OpenedOn, ClosedOn: a.ClosedOn,
		}
	}
	return out, nil
}

// MissingPayees returns the ids that are not payees of the user, in input order.
func (s *Service) MissingPayees(ctx context.Context, userID int64, ids []uuid.UUID) ([]uuid.UUID, error) {
	found, err := s.repo.ExistingPayees(ctx, userID, ids)
	if err != nil {
		return nil, err
	}
	var missing []uuid.UUID
	for _, id := range ids {
		if _, ok := found[id]; !ok {
			missing = append(missing, id)
		}
	}
	return missing, nil
}

// PayeeClass keys the category history of a payee by category class.
type PayeeClass struct {
	PayeeID uuid.UUID
	Class   string
}

// LatestPayeeCategories returns, per payee and class, the category of the most recent
// non-voided transaction whose only category posting is categorized (P5 amendment A23).
func (s *Service) LatestPayeeCategories(ctx context.Context, userID int64, payees []uuid.UUID) (map[PayeeClass]uuid.UUID, error) {
	return s.repo.LatestPayeeCategories(ctx, userID, payees)
}
