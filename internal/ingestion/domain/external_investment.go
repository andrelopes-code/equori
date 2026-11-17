package domain

import (
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	MovementBuy          = "buy"
	MovementSell         = "sell"
	MovementIncome       = "income"
	MovementTax          = "tax"
	MovementAmortization = "amortization"
	MovementTransfer     = "transfer"

	ProposalApplication  = "application"
	ProposalContribution = "contribution"
	ProposalSale         = "sale"
	ProposalIncome       = "income"
	ProposalTaxOfSale    = "tax_of_sale"
	ProposalNone         = "none"

	MovementPending   = "pending"
	MovementConfirmed = "confirmed"
	MovementDismissed = "dismissed"

	// TaxWindowDays is how far from a sale a tax movement still belongs to it.
	TaxWindowDays = 3
)

// ExternalInvestment is an investment an aggregator reports, with its movements (A236 FC27).
type ExternalInvestment struct {
	ID, Type, Subtype, Name        string
	Issuer, IssuerScheme, IssuerID string
	IndexID                        string
	PercentOfIndexBP, SpreadBP     int
	HasTerms                       bool
	IssuedOn, MaturesOn            *time.Time
	Quantity                       string // decimal text of the source, informative
	Balance                        money.Money
	BalanceDate                    time.Time
	Movements                      []ExternalMovement
}

type ExternalMovement struct {
	ID, Kind string
	Date     time.Time
	Quantity string // decimal text of the source, informative
	Amount   money.Money
}

// StoredMovement is a stored movement of one investment.
type StoredMovement struct {
	ID            uuid.UUID
	ExternalID    string
	Kind          string
	Date          time.Time
	Amount        money.Money
	State         string
	TransactionID *uuid.UUID
	ApplicationID uuid.UUID
}

// Proposal is what a movement proposes. Taxes is the sum of the taxes attached to a sale;
// SaleIndex is the index of the sale of a tax_of_sale, else -1.
type Proposal struct {
	Kind      string
	Taxes     int64
	SaleIndex int
}

// Propose returns, for each movement in input order, its proposal and, for a sale, the
// taxes attached to it; for a tax_of_sale, the index of its sale. The movements belong to
// one investment.
func Propose(ms []StoredMovement) []Proposal {
	first := earliestBuy(ms)

	out := make([]Proposal, len(ms))
	for i := range out {
		out[i] = Proposal{Kind: ProposalNone, SaleIndex: -1}
	}

	for i, m := range ms {
		switch m.Kind {
		case MovementBuy:
			out[i].Kind = ProposalContribution
			if i == first {
				out[i].Kind = ProposalApplication
			}
		case MovementSell:
			out[i].Kind = ProposalSale
		case MovementIncome:
			out[i].Kind = ProposalIncome
		case MovementTax:
			if sale := nearestSale(ms, m); sale >= 0 {
				out[i] = Proposal{Kind: ProposalTaxOfSale, SaleIndex: sale}
				out[sale].Taxes += m.Amount.Amount()
			}
		}
	}

	return out
}

// earliestBuy returns the index of the first buy by date then external id, or -1.
func earliestBuy(ms []StoredMovement) int {
	first := -1

	for i, m := range ms {
		if m.Kind == MovementBuy && (first < 0 || before(m, ms[first])) {
			first = i
		}
	}

	return first
}

// nearestSale returns the index of the sale within TaxWindowDays of the tax and nearer to it
// than any other sale, or -1. A tie goes to the earlier sale.
func nearestSale(ms []StoredMovement, tax StoredMovement) int {
	best, bestDays := -1, TaxWindowDays+1

	for i, m := range ms {
		if m.Kind != MovementSell {
			continue
		}

		if d := daysBetween(m.Date, tax.Date); d < bestDays ||
			d == bestDays && best >= 0 && before(m, ms[best]) {
			best, bestDays = i, d
		}
	}

	return best
}

func before(a, b StoredMovement) bool {
	if c := a.Date.Compare(b.Date); c != 0 {
		return c < 0
	}

	return strings.Compare(a.ExternalID, b.ExternalID) < 0
}

func daysBetween(a, b time.Time) int {
	d := int(a.Sub(b).Hours() / 24)
	if d < 0 {
		return -d
	}

	return d
}
