package domain

import "regexp"

// IdentifierScheme names a system that issues institution identifiers and the pattern they follow.
type IdentifierScheme struct {
	ID      string
	Pattern *regexp.Regexp
}

// IdentifierSchemes returns the registry of institution identifier schemes, ordered by ID.
func IdentifierSchemes() []IdentifierScheme {
	return []IdentifierScheme{
		{ID: "bic", Pattern: regexp.MustCompile(`^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$`)},
		{ID: "br_ispb", Pattern: regexp.MustCompile(`^[0-9]{8}$`)},
	}
}

// ValidateIdentifier reports the field that breaks the scheme registry: scheme when unknown, identifier when it does not match the pattern.
func ValidateIdentifier(scheme, identifier string) error {
	for _, s := range IdentifierSchemes() {
		if s.ID != scheme {
			continue
		}
		if !s.Pattern.MatchString(identifier) {
			return invalid("identifier", "must match "+s.Pattern.String())
		}
		return nil
	}
	return invalid("scheme", "must be a known identifier scheme")
}
