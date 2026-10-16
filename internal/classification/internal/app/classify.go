package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const runPage = 500

// catalog loads what decisions read, except payee history.
func (s *Service) catalog(ctx context.Context, userID int64) (domain.Catalog, map[uuid.UUID]Account, error) {
	rules, err := s.repo.EnabledRules(ctx, userID)
	if err != nil {
		return domain.Catalog{}, nil, err
	}
	aliases, err := s.repo.Aliases(ctx, userID)
	if err != nil {
		return domain.Catalog{}, nil, err
	}
	domain.SortAliases(aliases)
	accounts, err := s.accounts(ctx, userID)
	if err != nil {
		return domain.Catalog{}, nil, err
	}
	categories := map[uuid.UUID]domain.Category{}
	for id, a := range accounts {
		if a.isCategory() && !a.isUncategorized() {
			categories[id] = domain.Category{Class: a.Class, Instrument: a.Instrument, OpenedOn: a.OpenedOn, ClosedOn: a.ClosedOn}
		}
	}
	return domain.Catalog{Rules: rules, Aliases: aliases, Categories: categories}, accounts, nil
}

// decideAll decides every subject; payee history is loaded once for the payees that rules
// leave without a category (P5 amendment A23).
func (s *Service) decideAll(ctx context.Context, userID int64, c domain.Catalog, subjects []domain.Subject) ([]domain.Decision, error) {
	decisions := make([]domain.Decision, len(subjects))
	var payees []uuid.UUID
	for i, subj := range subjects {
		decisions[i] = domain.Decide(subj, c)
		if p := decisions[i].Payee(subj); decisions[i].Method == "" && p != uuid.Nil {
			payees = append(payees, p)
		}
	}
	if len(payees) == 0 {
		return decisions, nil
	}
	history, err := s.ledger.LatestPayeeCategories(ctx, userID, payees)
	if err != nil {
		return nil, err
	}
	c.History = history
	for i, subj := range subjects {
		if decisions[i].Method == "" {
			decisions[i] = domain.Decide(subj, c)
		}
	}
	return decisions, nil
}

// classify runs F5 on the uncategorized transactions among ids and returns how many got a
// category. A transaction that changed since its facts were read is left as it is.
func (s *Service) classify(ctx context.Context, userID int64, ids []uuid.UUID) (int, error) {
	facts, err := s.ledger.TransactionFacts(ctx, userID, ids)
	if err != nil {
		return 0, err
	}
	c, accounts, err := s.catalog(ctx, userID)
	if err != nil {
		return 0, err
	}
	var subjects []domain.Subject
	var targets []TransactionFacts
	for _, f := range facts {
		if f.Voided || f.CategoryState != stateUncategorized {
			continue
		}
		subjects = append(subjects, subjectOf(f, accounts))
		targets = append(targets, f)
	}
	decisions, err := s.decideAll(ctx, userID, c, subjects)
	if err != nil {
		return 0, err
	}
	var cs []Categorization
	for i, d := range decisions {
		if d.Method == "" && d.PayeeID == uuid.Nil && len(d.AddTags) == 0 {
			continue
		}
		cs = append(cs, categorization(targets[i].ID, targets[i].Version, d))
	}
	if len(cs) == 0 {
		return 0, nil
	}
	errs, err := s.ledger.Categorize(ctx, userID, cs)
	if err != nil {
		return 0, err
	}
	n := 0
	for i, e := range errs {
		if e == nil && cs[i].Method != "" {
			n++
		}
	}
	return n, nil
}

func categorization(id uuid.UUID, version int, d domain.Decision) Categorization {
	c := Categorization{TransactionID: id, ExpectedVersion: version, AddTags: d.AddTags, Method: d.Method, RuleID: d.RuleID, Parts: d.Parts}
	if d.PayeeID != uuid.Nil {
		c.PayeeID = &d.PayeeID
	}
	return c
}

// subjectOf describes an uncategorized transaction for rules (P5 amendment A21).
func subjectOf(f TransactionFacts, accounts map[uuid.UUID]Account) domain.Subject {
	s := domain.Subject{Date: f.Date, Description: f.Description, RawDescription: f.RawDescription, PayeeID: f.PayeeID, Source: f.Origin}
	var total money.Money
	for _, p := range f.Postings {
		s.Installment = s.Installment || p.Installment
		switch {
		case p.isCategory():
			if s.Class == "" {
				s.Class, total = p.Class, p.Amount
			} else if sum, err := total.Add(p.Amount); err == nil {
				total = sum
			}
		case p.Class == "asset" || p.Class == "liability":
			s.Accounts = append(s.Accounts, p.AccountID)
			s.AccountKinds = append(s.AccountKinds, accounts[p.AccountID].Kind)
		}
	}
	s.Amount = total.Neg()
	return s
}

// RunRules runs F5 on every uncategorized transaction, in pages (POST /rules/run).
func (s *Service) RunRules(ctx context.Context, userID int64) (examined, categorized int, err error) {
	var after *PendingKey
	for {
		ids, next, err := s.repo.PendingCategorizations(ctx, userID, after, runPage)
		if err != nil {
			return examined, categorized, err
		}
		n, err := s.classify(ctx, userID, ids)
		if err != nil {
			return examined, categorized, err
		}
		examined, categorized = examined+len(ids), categorized+n
		if next == nil {
			return examined, categorized, nil
		}
		after = next
	}
}
