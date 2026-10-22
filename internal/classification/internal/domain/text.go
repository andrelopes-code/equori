package domain

import (
	"strings"

	"github.com/andrelopes-code/equori/internal/platform/textfold"
)

// Normalize lowercases s, removes the diacritics of Latin letters, collapses inner
// whitespace and trims it (P5 amendment A26).
func Normalize(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		words[i] = textfold.String(w)
	}
	return strings.Join(words, " ")
}
