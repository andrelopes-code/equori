// Package textfold folds text to a lowercase form without diacritics for matching in any script.
package textfold

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// special holds letters that have no canonical decomposition but fold to a base letter.
var special = map[rune]rune{'ø': 'o', 'đ': 'd', 'ħ': 'h', 'ı': 'i', 'ŀ': 'l', 'ł': 'l', 'ŧ': 't', 'ſ': 's'}

// Rune returns r lowercased; a Latin letter also loses its diacritics.
func Rune(r rune) rune {
	l := unicode.ToLower(r)
	if base, ok := special[l]; ok {
		return base
	}
	if !unicode.Is(unicode.Latin, l) {
		return l
	}
	for _, d := range norm.NFD.String(string(l)) {
		if !unicode.Is(unicode.Mn, d) {
			return d
		}
	}
	return l
}

// String returns s with every rune folded by Rune.
func String(s string) string { return strings.Map(Rune, s) }
