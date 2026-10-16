package domain

import (
	"strings"
	"unicode"
)

// latinFold maps U+00C0–U+017F to lowercase letters without diacritics; letters without a
// base letter (æ, ð, þ, ß, œ, ĳ, ĸ, ŉ, ŋ) and the signs × and ÷ map to themselves in lowercase.
var latinFold = []rune("aaaaaaæceeeeiiiiðnooooo×ouuuuyþß" + "aaaaaaæceeeeiiiiðnooooo÷ouuuuyþy" +
	"aaaaaaccccccccddddeeeeeeeeeegggggggghhhhiiiiiiiiiiĳĳjjkkĸllllllllllnnnnnnŉŋŋoooooo" +
	"œœrrrrrrssssssssttttttuuuuuuuuuuuuwwyyyzzzzzzs")

const (
	latinFirst = 0xC0
	latinLast  = 0x17F
)

// Normalize lowercases s, removes the diacritics of Latin letters, collapses inner
// whitespace and trims it (P5 amendment A26).
func Normalize(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		words[i] = strings.Map(fold, w)
	}
	return strings.Join(words, " ")
}

func fold(r rune) rune {
	if r >= latinFirst && r <= latinLast {
		return latinFold[r-latinFirst]
	}
	return unicode.ToLower(r)
}
