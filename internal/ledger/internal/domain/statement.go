package domain

import "time"

const (
	RoleCharge  = "charge"
	RoleCredit  = "credit"
	RolePayment = "payment"

	StatusOpen          = "open"
	StatusClosed        = "closed"
	StatusPaid          = "paid"
	StatusPartiallyPaid = "partially_paid"
	StatusOverdue       = "overdue"
	StatusFinanced      = "financed"
)

// StatementLine is one card posting; Amount uses the ledger sign (a charge is negative).
type StatementLine struct {
	Role   string
	Amount int64
}

type StatementInput struct {
	Reference ReferenceMonth
	Closing   time.Time
	Due       time.Time // already adjusted by the calendar
	Lines     []StatementLine
	Financed  bool
}

// StatementSummary amounts are positive when the user owes them (chapter 5, 5.2.4).
type StatementSummary struct {
	Reference ReferenceMonth
	Opening   int64
	Charges   int64
	Credits   int64
	AmountDue int64
	Payments  int64
	Unpaid    int64 // negative when payments exceed the amount due: a credit carried forward
	Status    string
}

// Summarize walks consecutive statements of one card in reference order; each statement
// opens with the previous one's unpaid amount (revolving credit or carried credit).
func Summarize(in []StatementInput, today time.Time) []StatementSummary {
	out := make([]StatementSummary, len(in))
	var carry int64
	for i, s := range in {
		sum := StatementSummary{Reference: s.Reference, Opening: carry}
		for _, l := range s.Lines {
			switch l.Role {
			case RoleCharge:
				sum.Charges -= l.Amount
			case RoleCredit:
				sum.Credits += l.Amount
			case RolePayment:
				sum.Payments += l.Amount
			}
		}
		sum.AmountDue = sum.Opening + sum.Charges - sum.Credits
		sum.Unpaid = sum.AmountDue - sum.Payments
		sum.Status = status(s, sum, today)
		out[i] = sum
		carry = sum.Unpaid
	}
	return out
}

func status(s StatementInput, sum StatementSummary, today time.Time) string {
	paid := sum.Unpaid <= 0
	switch {
	case s.Financed:
		return StatusFinanced
	case today.Before(s.Closing):
		if paid && sum.AmountDue > 0 {
			return StatusPaid
		}
		return StatusOpen
	case paid:
		return StatusPaid
	case today.After(s.Due):
		return StatusOverdue
	case sum.Payments > 0:
		return StatusPartiallyPaid
	default:
		return StatusClosed
	}
}
