package domain

import "github.com/google/uuid"

type LinkType string

const (
	LinkRefundOf        LinkType = "refund_of"
	LinkReimbursementOf LinkType = "reimbursement_of"
	LinkCancellationOf  LinkType = "cancellation_of"
	LinkAnticipationOf  LinkType = "anticipation_of"
	LinkChargebackOf    LinkType = "chargeback_of"
	LinkCorrectionOf    LinkType = "correction_of"
)

var linkTypes = []LinkType{
	LinkRefundOf,
	LinkReimbursementOf,
	LinkCancellationOf,
	LinkAnticipationOf,
	LinkChargebackOf,
	LinkCorrectionOf,
}

// Link relates a transaction to another. Amount, when not zero, is the part of the target that a
// reimbursement_of link repays (A117), in the balancing currency of the transaction.
type Link struct {
	Type   LinkType
	Target uuid.UUID
	Amount int64
}
