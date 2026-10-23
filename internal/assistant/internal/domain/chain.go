package domain

import (
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
)

// ChainTarget is one model of one provider in a user's chain for a use. Capabilities are
// the owner's assertion; ModelCapabilities prefers the preset's.
type ChainTarget struct {
	ProviderID   uuid.UUID
	Model        string
	Capabilities []string
}

const maxModelLength = 200

func NewChainTarget(providerID uuid.UUID, model string, capabilities []string) (ChainTarget, error) {
	model = strings.TrimSpace(model)
	if model == "" || utf8.RuneCountInString(model) > maxModelLength {
		return ChainTarget{}, invalid("model", "must have 1 to 200 characters")
	}
	if err := ValidateCapabilities(capabilities); err != nil {
		return ChainTarget{}, err
	}
	if capabilities == nil {
		capabilities = []string{} // the column is NOT NULL
	}
	return ChainTarget{ProviderID: providerID, Model: model, Capabilities: capabilities}, nil
}
