package domain

import "github.com/google/uuid"

// MatchKey groups transactions for rule suggestions: the payee, or the normalized raw
// description without a payee (P5 amendment A24).
func MatchKey(payee uuid.UUID, raw string) string {
	if payee != uuid.Nil {
		return "payee:" + payee.String()
	}
	return "description:" + Normalize(raw)
}

// Fingerprint identifies a suggestion; one exists per fingerprint ever.
func Fingerprint(matchKey string, category uuid.UUID) string {
	return matchKey + " -> " + category.String()
}

// SuggestedRule returns the conditions and actions of a suggestion for a match key.
func SuggestedRule(payee uuid.UUID, raw string, category uuid.UUID) ([]Condition, []Action) {
	condition := Condition{Field: FieldRawDescription, Operator: OpEquals, Text: []string{Normalize(raw)}}
	if payee != uuid.Nil {
		condition = Condition{Field: FieldPayee, Operator: OpEquals, IDs: []uuid.UUID{payee}}
	}
	return []Condition{condition}, []Action{{Type: ActionSetCategory, CategoryID: category}}
}
