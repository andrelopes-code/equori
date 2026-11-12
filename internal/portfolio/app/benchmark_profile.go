package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

const typeFixedIncome = "fixed_income"

// profileOf is ProfileRate when each asset account of the trees of ids holds currency in or a
// fixed income instrument quoted in it, and ProfileMarket otherwise (amendment A208 R11).
// recorded is true for a rate tree that holds no fixed income instrument: its yield is the income
// the ledger records (R18), while the yield of a fixed income instrument is in its price.
func (s *Service) profileOf(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
	in money.Currency,
) (profile string, recorded bool, err error) {
	accounts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return "", false, err
	}

	recorded = true

	for _, a := range treeAccounts(accounts, ids) {
		if a.Class != classAsset || a.Instrument == in {
			continue
		}

		info, err := s.md.InstrumentOf(ctx, a.Instrument)
		if err != nil {
			return "", false, err
		}

		if info.Type != typeFixedIncome || info.QuoteCurrency != in {
			return ProfileMarket, false, nil
		}

		recorded = false
	}

	return ProfileRate, recorded, nil
}

// treeAccounts returns the accounts of ids and their descendants.
func treeAccounts(accounts []Account, ids []uuid.UUID) []Account {
	in := make(map[uuid.UUID]bool, len(ids))
	for _, id := range ids {
		in[id] = true
	}

	// A parent can follow its child in accounts: repeat until no account joins the tree.
	for grew := true; grew; {
		grew = false

		for _, a := range accounts {
			if !in[a.ID] && in[a.ParentID] {
				in[a.ID] = true
				grew = true
			}
		}
	}

	var out []Account
	for _, a := range accounts {
		if in[a.ID] {
			out = append(out, a)
		}
	}

	return out
}
