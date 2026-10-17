package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// RecordTrade records M17: a purchase or sale of a security for cash of the same
// brokerage, the sale at average cost (P8 amendment A68).
func (s *Service) RecordTrade(ctx context.Context, userID int64, o domain.TradeOrder) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		base, err := baseCurrency(ctx, r, userID)
		if err != nil {
			return err
		}
		security, cash, err := s.brokerageAccounts(ctx, r, userID, o.AccountID, o.CashAccountID, base)
		if err != nil {
			return err
		}
		if o.Quantity.Currency() != security.Instrument {
			return fieldErr("quantity", "must be an amount of "+string(security.Instrument), domain.ErrValidation)
		}
		// Two sales of one account serialize on its row, so each reads the holding the other left.
		if _, err := r.LockAccount(ctx, userID, security.ID); err != nil {
			return err
		}
		quantity, basis, err := r.Holding(ctx, userID, security.ID, o.Date)
		if err != nil {
			return err
		}
		var h domain.Holding
		if h.Quantity, err = s.AmountOf(ctx, quantity, security.Instrument); err != nil {
			return err
		}
		if h.CostBasis, err = money.New(basis, base); err != nil {
			return err
		}
		accts, err := s.tradeAccounts(ctx, r, userID, o.TaxesCategoryID)
		if err != nil {
			return err
		}
		postings, trade, err := domain.BuildTrade(o, cash.Instrument, h, accts)
		if err != nil {
			return err
		}
		created, err = s.insert(ctx, r, domain.Transaction{
			UserID: userID, Date: o.Date, Description: o.Description, BalancingCurrency: base, Postings: postings, Trade: &trade,
		})
		return err
	})
	return created, err
}

// brokerageAccounts checks a security account and a cash account of the same brokerage
// in the base currency.
func (s *Service) brokerageAccounts(ctx context.Context, r Repository, userID int64, securityID, cashID uuid.UUID, base money.Currency) (domain.Account, domain.Account, error) {
	security, err := loadAccount(ctx, r, userID, securityID, "account_id")
	if err != nil {
		return domain.Account{}, domain.Account{}, err
	}
	if !security.HoldsSecurity() {
		return domain.Account{}, domain.Account{}, fieldErr("account_id", "must hold a security", domain.ErrValidation)
	}
	cash, err := loadAccount(ctx, r, userID, cashID, "cash_account_id")
	if err != nil {
		return domain.Account{}, domain.Account{}, err
	}
	if cash.HoldsSecurity() || cash.ParentID != security.ParentID {
		return domain.Account{}, domain.Account{}, fieldErr("cash_account_id", "must be a cash account of the brokerage holding account_id", domain.ErrValidation)
	}
	if cash.Instrument != base {
		return domain.Account{}, domain.Account{}, fieldErr("cash_account_id", "must be in the base currency "+string(base), domain.ErrCurrencyUnsupported)
	}
	return security, cash, nil
}

func (s *Service) tradeAccounts(ctx context.Context, r Repository, userID int64, taxesCategory uuid.UUID) (domain.TradeAccounts, error) {
	var accts domain.TradeAccounts
	for _, x := range []struct {
		role domain.SystemRole
		id   *uuid.UUID
	}{{domain.RoleRealizedGains, &accts.RealizedGains}, {domain.RoleRealizedLosses, &accts.RealizedLosses}, {domain.RoleTaxes, &accts.Taxes}} {
		a, err := r.SystemAccount(ctx, userID, x.role)
		if err != nil {
			return domain.TradeAccounts{}, err
		}
		*x.id = a.ID
	}
	if taxesCategory != uuid.Nil {
		if err := s.expenseCategory(ctx, r, userID, taxesCategory, "taxes_category_id"); err != nil {
			return domain.TradeAccounts{}, err
		}
		accts.Taxes = taxesCategory
	}
	return accts, nil
}

// checkLaterSales rejects a change to postings of accounts dated on or before a
// non-voided sale of one of them other than exclude (P8 amendment A69).
func checkLaterSales(ctx context.Context, r Repository, userID int64, date time.Time, postings []domain.Posting, exclude uuid.UUID) error {
	ids := make([]uuid.UUID, 0, len(postings))
	for _, p := range postings {
		if isSecurity(p.Amount.Currency()) {
			ids = append(ids, p.AccountID)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	later, err := r.LaterSaleExists(ctx, userID, ids, date, exclude)
	if err != nil {
		return err
	}
	if later {
		return ErrLaterSaleExists
	}
	return nil
}

func isSecurity(c money.Currency) bool {
	_, err := money.ParseCurrency(string(c))
	return err != nil
}
