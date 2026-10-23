package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/domain"
)

const (
	classAsset     = "asset"
	classLiability = "liability"
	typeCurrency   = "currency"
)

// AccountBalance is the balance of one balance-sheet account in its own instrument.
type AccountBalance struct {
	AccountID uuid.UUID
	Amount    money.Money
}

// InstrumentInfo is what an allocation reads of an instrument.
type InstrumentInfo struct {
	Type          string
	QuoteCurrency money.Currency
}

// AllocationGroup is the value held under one key of an allocation and its share in basis points.
type AllocationGroup struct {
	Key     string
	Value   money.Money
	ShareBP int
}

// AllocationReport is the value of the assets at a date grouped by a dimension.
type AllocationReport struct {
	Total  money.Money
	Groups []AllocationGroup
}

// NetWorthReport is the value of the assets and of the liabilities at a date.
type NetWorthReport struct {
	Assets, Liabilities, Net money.Money
}

// valuedBalance is the balance of an account valued in the report currency.
type valuedBalance struct {
	account Account
	balance AccountBalance
	value   money.Money
}

// valuedBalances values the non-zero balance of every asset and liability account in in with the
// stored prices of date; the error wraps ErrPriceMissing when one is missing.
func (s *Service) valuedBalances(ctx context.Context, userID int64, date time.Time, in money.Currency) ([]valuedBalance, error) {
	accounts, err := s.ledger.AccountFacts(ctx, userID)
	if err != nil {
		return nil, err
	}
	byID := make(map[uuid.UUID]Account, len(accounts))
	for _, a := range accounts {
		byID[a.ID] = a
	}
	balances, err := s.ledger.Balances(ctx, userID, date)
	if err != nil {
		return nil, err
	}
	var out []valuedBalance
	for _, b := range balances {
		if b.Amount.IsZero() {
			continue
		}
		value := b.Amount
		if value.Currency() != in {
			if value, _, err = s.md.Convert(ctx, value, in, date); err != nil {
				return nil, fmt.Errorf("value the balance of %s: %w", b.AccountID, err)
			}
		}
		out = append(out, valuedBalance{account: byID[b.AccountID], balance: b, value: value})
	}
	return out, nil
}

func (s *Service) reportCurrency(ctx context.Context, userID int64, in money.Currency) (money.Currency, error) {
	if in != "" {
		return in, nil
	}
	return s.ledger.BaseCurrency(ctx, userID)
}

// Allocation groups the value of the asset accounts at date by "type" (the type of the
// instrument held), "currency" (the quotation currency of the instrument, or the currency
// itself) or "institution" (the institution id, empty without one); in defaults to the base
// currency.
func (s *Service) Allocation(ctx context.Context, userID int64, date time.Time, by string, in money.Currency) (AllocationReport, error) {
	in, err := s.reportCurrency(ctx, userID, in)
	if err != nil {
		return AllocationReport{}, err
	}
	balances, err := s.valuedBalances(ctx, userID, date, in)
	if err != nil {
		return AllocationReport{}, err
	}
	var holdings []domain.Holding
	for _, v := range balances {
		if v.account.Class != classAsset {
			continue
		}
		key, err := s.allocationKey(ctx, v, by)
		if err != nil {
			return AllocationReport{}, err
		}
		holdings = append(holdings, domain.Holding{Key: key, Value: v.value.Amount()})
	}
	total, err := money.New(0, in)
	if err != nil {
		return AllocationReport{}, err
	}
	report := AllocationReport{Total: total}
	for _, g := range domain.Allocate(holdings) {
		value, err := money.New(g.Value, in)
		if err != nil {
			return AllocationReport{}, err
		}
		if report.Total, err = report.Total.Add(value); err != nil {
			return AllocationReport{}, fmt.Errorf("sum the groups: %w", err)
		}
		report.Groups = append(report.Groups, AllocationGroup{Key: g.Key, Value: value, ShareBP: g.ShareBP})
	}
	return report, nil
}

func (s *Service) allocationKey(ctx context.Context, v valuedBalance, by string) (string, error) {
	if by == "institution" {
		if v.account.InstitutionID == uuid.Nil {
			return "", nil
		}
		return v.account.InstitutionID.String(), nil
	}
	info, err := s.md.InstrumentOf(ctx, v.balance.Amount.Currency())
	if err != nil {
		return "", err
	}
	if by == "type" {
		return info.Type, nil
	}
	if info.Type == typeCurrency {
		return string(v.balance.Amount.Currency()), nil
	}
	return string(info.QuoteCurrency), nil
}

// NetWorth is the value of the asset accounts, the value of the liability accounts as a positive
// amount, and their difference at date, in in (the base currency by default).
func (s *Service) NetWorth(ctx context.Context, userID int64, date time.Time, in money.Currency) (NetWorthReport, error) {
	in, err := s.reportCurrency(ctx, userID, in)
	if err != nil {
		return NetWorthReport{}, err
	}
	balances, err := s.valuedBalances(ctx, userID, date, in)
	if err != nil {
		return NetWorthReport{}, err
	}
	var assets, liabilities int64
	for _, v := range balances {
		switch v.account.Class {
		case classAsset:
			assets += v.value.Amount()
		case classLiability:
			liabilities -= v.value.Amount()
		}
	}
	report := NetWorthReport{}
	for _, f := range []struct {
		to     *money.Money
		amount int64
	}{{&report.Assets, assets}, {&report.Liabilities, liabilities}, {&report.Net, assets - liabilities}} {
		if *f.to, err = money.New(f.amount, in); err != nil {
			return NetWorthReport{}, err
		}
	}
	return report, nil
}
