// Package locale holds language and region identifiers and their number and date conventions.
package locale

import "regexp"

var languagePattern = regexp.MustCompile(`^[a-z]{2,3}$`)

// Locale is a language and a region, for example pt and BR.
type Locale struct{ Language, Region string }

// Tag returns the BCP 47 tag, for example "pt-BR".
func (l Locale) Tag() string { return l.Language + "-" + l.Region }

// ValidLanguage reports whether s is a lowercase language code of two or three letters.
func ValidLanguage(s string) bool { return languagePattern.MatchString(s) }

// ValidRegion reports whether s is an assigned ISO 3166-1 alpha-2 code.
func ValidRegion(s string) bool {
	if len(s) != 2 {
		return false
	}
	for _, code := range Regions() {
		if code == s {
			return true
		}
	}
	return false
}
