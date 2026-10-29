package domain

import (
	"slices"
	"time"
)

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

	BasisDate        = "date"
	BasisOwner       = "owner"
	BasisInstitution = "institution"
)

// ProvisionalWindow is how many days before its statement's closing a card posting may still
// post on the next statement; it equals ingestion's MatchHardLimit (A136).
const ProvisionalWindow = 10

// Provisional reports whether the statement of a card posting dated d may still change: no
// line stated its bill, its statement is not reconciled and d falls within ProvisionalWindow
// days before closing (A136). An installment follows its plan, not the posting date.
func Provisional(basis string, d, closing time.Time, reconciled, installment bool) bool {
	return basis != BasisInstitution && !reconciled && !installment && !d.Before(closing.AddDate(0, 0, -ProvisionalWindow))
}

// StatementLine is one card posting; Amount uses the ledger sign (a charge is negative).
type StatementLine struct {
	Role   string
	Amount int64
	Date   time.Time
}

type StatementInput struct {
	Reference ReferenceMonth
	Closing   time.Time
	Due       time.Time // already adjusted by the calendar
	Lines     []StatementLine
	Financed  bool
}

// StatementSummary amounts are positive when the user owes them (chapter 5, 5.2.4, A89).
type StatementSummary struct {
	Reference ReferenceMonth
	Opening   int64 // the previous statement's amount due
	Charges   int64
	Credits   int64 // every credit billed on the statement, PriorCredits included
	Payments  int64 // every payment billed on the statement, made in its cycle
	AmountDue int64 // the card balance at closing: opening + charges − credits − payments
	Settled   int64 // inflows of the next statement, dated on or before today, that cover AmountDue
	Unpaid    int64 // AmountDue − Settled; zero for a credit balance
	Status    string

	PriorCredits  int64 // credits of the statement that settled the previous one
	EarlyPayments int64 // payments of the statement beyond what settled the previous one
	BilledAmount  int64 // AmountDue + EarlyPayments: the bill before early payments
	// OpenAmount leaves out the previous statement's unpaid amount until it is overdue, as the
	// institution's open bill does (A138).
	OpenAmount int64
}

// Summarize walks consecutive statements of one card in reference order. Each opens with
// the previous one's amount due, and is settled by the credits and payments of the next
// statement dated after its closing, in date order, up to today (A89, A96).
func Summarize(in []StatementInput, today time.Time) []StatementSummary {
	out := make([]StatementSummary, len(in))
	var opening int64
	for i, s := range in {
		sum := StatementSummary{Reference: s.Reference, Opening: opening}
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
		sum.AmountDue = sum.Opening + sum.Charges - sum.Credits - sum.Payments
		out[i] = sum
		opening = sum.AmountDue
	}
	if len(out) > 0 {
		// The first statement's payments settled nothing equori holds.
		out[0].EarlyPayments = out[0].Payments
	}
	for i := range out {
		var next []StatementLine
		if i+1 < len(in) {
			next = in[i+1].Lines
		}
		credits, payments := settle(&out[i], in[i].Closing, next, today)
		out[i].Unpaid = max(out[i].AmountDue, 0) - out[i].Settled
		if i+1 < len(out) {
			out[i+1].PriorCredits = credits
			out[i+1].EarlyPayments = out[i+1].Payments - payments
		}
	}
	for i, s := range in {
		out[i].BilledAmount = out[i].AmountDue + out[i].EarlyPayments
		out[i].Status = status(s, out[i], today)
		out[i].OpenAmount = out[i].AmountDue
		if i > 0 && (out[i-1].Status == StatusClosed || out[i-1].Status == StatusPartiallyPaid) {
			out[i].OpenAmount -= out[i-1].Unpaid
		}
	}
	return out
}

// settle covers sum's amount due with the inflows of the next statement dated after closing
// and on or before today, oldest first, and returns how much of its credits and payments it
// used. An inflow dated on or before closing, such as the reversal of a cancelled installment,
// nets against the next statement instead (A96).
func settle(sum *StatementSummary, closing time.Time, next []StatementLine, today time.Time) (credits, payments int64) {
	inflows := slices.SortedStableFunc(slices.Values(next), func(a, b StatementLine) int { return a.Date.Compare(b.Date) })
	left := max(sum.AmountDue, 0)
	for _, l := range inflows {
		if left == 0 || l.Date.After(today) {
			break
		}
		if (l.Role != RoleCredit && l.Role != RolePayment) || !l.Date.After(closing) {
			continue
		}
		used := min(l.Amount, left)
		left -= used
		if l.Role == RoleCredit {
			credits += used
		} else {
			payments += used
		}
	}
	sum.Settled = max(sum.AmountDue, 0) - left
	return credits, payments
}

func status(s StatementInput, sum StatementSummary, today time.Time) string {
	switch {
	case s.Financed:
		return StatusFinanced
	case today.Before(s.Closing):
		if sum.AmountDue <= 0 && sum.BilledAmount > 0 {
			return StatusPaid
		}
		return StatusOpen
	case sum.Unpaid <= 0:
		return StatusPaid
	case today.After(s.Due):
		return StatusOverdue
	case sum.Settled > 0:
		return StatusPartiallyPaid
	default:
		return StatusClosed
	}
}
