package domain_test

import (
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

func TestTitle(t *testing.T) {
	t.Parallel()
	words := strings.Repeat("abcdefghi ", 10)[:100]
	noSpaces := strings.Repeat("x", 100)
	tests := []struct {
		name, in string
		check    func(t *testing.T, got string)
	}{
		{"collapses whitespace", "  Quanto  gastei\nontem? ", func(t *testing.T, got string) {
			if got != "Quanto gastei ontem?" {
				t.Errorf("got %q", got)
			}
		}},
		{"cuts at a word boundary", words, func(t *testing.T, got string) {
			if n := utf8.RuneCountInString(got); n > domain.MaxTitle || strings.HasSuffix(got, " ") || !strings.HasPrefix(words, got+" ") {
				t.Errorf("got %q (%d runes)", got, n)
			}
		}},
		{"cuts at rune 80 without spaces", noSpaces, func(t *testing.T, got string) {
			if got != noSpaces[:80] {
				t.Errorf("got %q", got)
			}
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) { tt.check(t, domain.Title(tt.in)) })
	}
}
