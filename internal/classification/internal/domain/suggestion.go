package domain

import (
	"strings"

	"github.com/google/uuid"
)

const (
	payeeKey       = "payee:"
	descriptionKey = "description:"
)

// MatchKey groups transactions for rule suggestions: the payee, or the normalized raw
// description without a payee (P5 amendment A24).
func MatchKey(payee uuid.UUID, raw string) string {
	if payee != uuid.Nil {
		return payeeKey + payee.String()
	}
	return descriptionKey + Normalize(raw)
}

// Fingerprint identifies a suggestion; one exists per fingerprint ever.
func Fingerprint(matchKey string, category uuid.UUID) string {
	return matchKey + " -> " + category.String()
}

// SuggestedRule returns the conditions and actions that a suggestion for the match key
// and category proposes.
func SuggestedRule(matchKey string, category uuid.UUID) ([]Condition, []Action) {
	actions := []Action{{Type: ActionSetCategory, CategoryID: category}}
	if id, err := uuid.Parse(strings.TrimPrefix(matchKey, payeeKey)); strings.HasPrefix(matchKey, payeeKey) && err == nil {
		return []Condition{{Field: FieldPayee, Operator: OpEquals, IDs: []uuid.UUID{id}}}, actions
	}
	text := strings.TrimPrefix(matchKey, descriptionKey)
	return []Condition{{Field: FieldRawDescription, Operator: OpEquals, Text: []string{text}, normalized: []string{text}}}, actions
}
