// Package charset decodes the text encodings that Brazilian bank exports use (P4 amendment A15).
package charset

import (
	"strings"
	"unicode/utf8"
)

// cp1252 holds the characters of bytes 0x80 to 0x9F, where Windows-1252 differs from Latin-1.
var cp1252 = [32]rune{
	'€', '�', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', '�', 'Ž', '�',
	'�', '‘', '’', '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', '�', 'ž', 'Ÿ',
}

// Text returns b as UTF-8: unchanged when it is valid UTF-8, otherwise decoded as Windows-1252.
func Text(b []byte) string {
	if utf8.Valid(b) {
		return string(b)
	}
	var sb strings.Builder
	sb.Grow(len(b) + len(b)/8)
	for _, c := range b {
		switch {
		case c < 0x80:
			sb.WriteByte(c)
		case c < 0xA0:
			sb.WriteRune(cp1252[c-0x80])
		default:
			sb.WriteRune(rune(c))
		}
	}
	return sb.String()
}
