package domain

import (
	"cmp"
	"fmt"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
)

type MatchType string

const (
	MatchEquals     MatchType = "equals"
	MatchStartsWith MatchType = "starts_with"
	MatchContains   MatchType = "contains"
	MatchRegex      MatchType = "regex"
)

// matchOrder ranks match types for P5 amendment A22.
var matchOrder = []MatchType{MatchEquals, MatchStartsWith, MatchContains, MatchRegex}

// Alias maps raw descriptions to a payee.
type Alias struct {
	ID        uuid.UUID
	Pattern   string
	MatchType MatchType
	PayeeID   uuid.UUID

	normalized string
	re         *regexp.Regexp
}

func NewAlias(a Alias) (Alias, error) {
	if n := utf8.RuneCountInString(a.Pattern); n == 0 || n > maxTextValue || strings.TrimSpace(a.Pattern) == "" {
		return Alias{}, invalid("pattern", fmt.Sprintf("must have 1 to %d characters", maxTextValue))
	}
	if !slices.Contains(matchOrder, a.MatchType) {
		return Alias{}, invalid("match_type", "must be equals, starts_with, contains or regex")
	}
	if a.PayeeID == uuid.Nil {
		return Alias{}, invalid("payee_id", "is required")
	}
	a.normalized = Normalize(a.Pattern)
	if a.MatchType == MatchRegex {
		re, err := regexp.Compile(a.Pattern)
		if err != nil {
			return Alias{}, invalid("pattern", "is not a valid RE2 pattern")
		}
		a.re = re
	}
	return a, nil
}

func (a Alias) matches(original, normalized string) bool {
	switch a.MatchType {
	case MatchEquals:
		return normalized == a.normalized
	case MatchStartsWith:
		return strings.HasPrefix(normalized, a.normalized)
	case MatchContains:
		return strings.Contains(normalized, a.normalized)
	case MatchRegex:
		return a.re.MatchString(original)
	}
	return false
}

// SortAliases orders aliases as P5 amendment A22 evaluates them; ids are UUIDv7, so the
// older alias has the smaller id.
func SortAliases(as []Alias) {
	slices.SortStableFunc(as, func(a, b Alias) int {
		return cmp.Or(
			cmp.Compare(slices.Index(matchOrder, a.MatchType), slices.Index(matchOrder, b.MatchType)),
			cmp.Compare(utf8.RuneCountInString(b.normalized), utf8.RuneCountInString(a.normalized)),
			strings.Compare(a.ID.String(), b.ID.String()),
		)
	})
}

// ResolvePayee returns the payee of the first alias, in SortAliases order, matching raw.
func ResolvePayee(raw string, sorted []Alias) (uuid.UUID, bool) {
	normalized := Normalize(raw)
	for _, a := range sorted {
		if a.matches(raw, normalized) {
			return a.PayeeID, true
		}
	}
	return uuid.Nil, false
}
