package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Prices stores the unit price an aggregator balance implies.
type Prices interface {
	RecordBalancePrice(
		ctx context.Context,
		booksID int64,
		instrument, quote money.Currency,
		on time.Time,
		value money.Rate,
		source string,
	) error
}

// InvestmentApplication is a purchase: Instrument names a held contract (a contribution), else
// the contract facts define a new one. A nil CashAccountID is uuid.Nil.
type InvestmentApplication struct {
	ApplicationID, BrokerageID, CashAccountID uuid.UUID
	On                                        time.Time
	Amount                                    money.Money
	Instrument                                money.Currency
	Subtype, Name, Issuer                     string
	IssuerScheme, IssuerID, IndexID           string
	PercentOfIndexBP, SpreadBP                int
	IssuedOn, MaturesOn                       time.Time
}

// AppliedInvestment is the purchase the ledger recorded.
type AppliedInvestment struct {
	TransactionID, AccountID uuid.UUID
	Instrument               money.Currency
}

// InvestmentSale sells the units that Amount covers at the unit price of On; Taxes is zero when
// none is attached.
type InvestmentSale struct {
	AccountID  uuid.UUID
	Instrument money.Currency
	On         time.Time
	Amount     money.Money
	Taxes      money.Money
}

// InvestmentIncome is interest paid on the holding AccountID, booked on the income category.
type InvestmentIncome struct {
	AccountID, CategoryID uuid.UUID
	On                    time.Time
	Gross                 money.Money
}

// LedgerRefusal is a refusal of the ledger that keeps its Problem.code and field.
type LedgerRefusal struct{ Code, Field, Message string }

func (e *LedgerRefusal) Error() string { return e.Message }

// MovementView is a movement after an operation, with what it proposes.
type MovementView struct {
	InvestmentID uuid.UUID
	Movement     domain.StoredMovement
	Proposal     domain.Proposal
}

// MovementChange is the new state of a movement; a nil TransactionID clears the link.
type MovementChange struct {
	ID            uuid.UUID
	State         string
	TransactionID *uuid.UUID
	ApplicationID uuid.UUID
}

// InvestmentLink sets the ledger link of an investment; nil fields clear it.
type InvestmentLink struct {
	InvestmentID uuid.UUID
	BrokerageID  *uuid.UUID
	AccountID    *uuid.UUID
	Instrument   *string
}

type resolution struct {
	changes []MovementChange
	link    *InvestmentLink
}

type reviewed struct {
	inv       domain.StoredInvestment
	index     int
	proposals []domain.Proposal
}

func (r reviewed) movement() domain.StoredMovement { return r.inv.Movements[r.index] }
func (r reviewed) proposal() domain.Proposal       { return r.proposals[r.index] }
