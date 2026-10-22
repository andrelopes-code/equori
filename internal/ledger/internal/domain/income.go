package domain

import (
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/registry"
)

type IncomeType string

const (
	IncomeDividend IncomeType = "dividend"
	IncomeJCP      IncomeType = "jcp"
	IncomeInterest IncomeType = "interest"
	IncomeCoupon   IncomeType = "coupon"
)

// JCPWithholdingBP is the income tax withheld on JCP when none is given (F9).
const JCPWithholdingBP = 1500

// IncomeOrder is investment income paid on a security into cash of the same brokerage (M18).
type IncomeOrder struct {
	AccountID, CashAccountID, CategoryID, WithheldCategoryID uuid.UUID
	Type                                                     IncomeType
	Date                                                     time.Time
	Gross                                                    money.Money
	Withheld                                                 *money.Money
	Description                                              string
}

// Income is the D1 detail stored with an income transaction (P8 amendment A70).
type Income struct {
	AccountID, CashAccountID uuid.UUID
	Type                     IncomeType
	Gross, Withheld          money.Money
}

// BuildIncome returns the postings cash, withheld tax and income category (P8 amendment A70).
func BuildIncome(o IncomeOrder) ([]Posting, Income, error) {
	if !registry.ValidID(string(o.Type)) {
		return nil, Income{}, invalid("income_type", "must match ^[a-z0-9_]{2,40}$")
	}
	if o.Gross.IsZero() || o.Gross.IsNegative() {
		return nil, Income{}, invalid("gross", "must be positive")
	}
	withheld, err := money.New(0, o.Gross.Currency())
	if err != nil {
		return nil, Income{}, invalid("gross", "must be a currency amount")
	}
	switch {
	case o.Withheld != nil:
		withheld = *o.Withheld
	case o.Type == IncomeJCP:
		if withheld, err = money.Fraction(o.Gross, JCPWithholdingBP, 10000); err != nil {
			return nil, Income{}, err
		}
	}
	net, err := o.Gross.Sub(withheld)
	if err != nil || withheld.IsNegative() || net.IsZero() || net.IsNegative() {
		return nil, Income{}, invalid("withheld", "must be at least zero and less than gross, in "+string(o.Gross.Currency()))
	}
	postings := []Posting{{AccountID: o.CashAccountID, Amount: net, Weight: net}}
	if !withheld.IsZero() {
		postings = append(postings, Posting{AccountID: o.WithheldCategoryID, Amount: withheld, Weight: withheld})
	}
	postings = append(postings, Posting{AccountID: o.CategoryID, Amount: o.Gross.Neg(), Weight: o.Gross.Neg()})
	return postings, Income{AccountID: o.AccountID, CashAccountID: o.CashAccountID, Type: o.Type, Gross: o.Gross, Withheld: withheld}, nil
}
