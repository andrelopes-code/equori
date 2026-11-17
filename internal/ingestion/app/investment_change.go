package app

import (
	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func confirmed(m domain.StoredMovement, txID *uuid.UUID) MovementChange {
	return MovementChange{
		ID:            m.ID,
		State:         domain.MovementConfirmed,
		TransactionID: txID,
		ApplicationID: m.ApplicationID,
	}
}

func reopened(m domain.StoredMovement, applicationID uuid.UUID) MovementChange {
	return MovementChange{ID: m.ID, State: domain.MovementPending, ApplicationID: applicationID}
}

// taxChanges moves the tax movements attached to the reviewed sale to state.
func taxChanges(r reviewed, state string) []MovementChange {
	var out []MovementChange

	for i, p := range r.proposals {
		if p.Kind == domain.ProposalTaxOfSale && p.SaleIndex == r.index {
			m := r.inv.Movements[i]
			out = append(
				out,
				MovementChange{ID: m.ID, State: state, ApplicationID: m.ApplicationID},
			)
		}
	}

	return out
}

// otherConfirmed tells whether a movement other than the reviewed one holds a confirmation.
func otherConfirmed(r reviewed) bool {
	for i, m := range r.inv.Movements {
		if i != r.index && m.State == domain.MovementConfirmed &&
			r.proposals[i].Kind != domain.ProposalTaxOfSale {
			return true
		}
	}

	return false
}

func absolute(m money.Money) money.Money {
	if m.IsNegative() {
		return m.Neg()
	}

	return m
}
