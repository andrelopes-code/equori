package domain

import "github.com/google/uuid"

// StoredInvestment is an investment of a connection as stored, with its movements. Source
// holds the columns the aggregator reports and no movements; the other fields are the link
// the owner sets when confirming the application (A236 FC28).
type StoredInvestment struct {
	ID           uuid.UUID
	ConnectionID uuid.UUID
	Source       ExternalInvestment
	BrokerageID  *uuid.UUID
	AccountID    *uuid.UUID
	Instrument   *string
	Movements    []StoredMovement
}
