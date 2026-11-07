package textfold_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/textfold"
)

// legacy is classification's table before this package (P5 amendment A26), U+00C0–U+017F.
var legacy = []rune("aaaaaaæceeeeiiiiðnooooo×ouuuuyþß" + "aaaaaaæceeeeiiiiðnooooo÷ouuuuyþy" +
	"aaaaaaccccccccddddeeeeeeeeeegggggggghhhhiiiiiiiiiiĳĳjjkkĸllllllllllnnnnnnŉŋŋoooooo" +
	"œœrrrrrrssssssssttttttuuuuuuuuuuuuwwyyyzzzzzzs")

func TestLatinRangeMatchesLegacyTable(t *testing.T) {
	for r := rune(0xC0); r <= 0x17F; r++ {
		if got, want := textfold.Rune(r), legacy[r-0xC0]; got != want {
			t.Errorf("Rune(%q) = %q, want %q", r, got, want)
		}
	}
}

func TestOtherScripts(t *testing.T) {
	for in, want := range map[string]string{"Ș": "s", "Ệ": "e", "Ǆ": "ǆ", "Й": "й", "Ά": "ά", "ÆON": "æon", "Straße": "straße"} {
		if got := textfold.String(in); got != want {
			t.Errorf("String(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestKey(t *testing.T) {
	t.Parallel()

	tests := []struct{ in, want string }{
		{"Coração", "coracao"},
		{"Corac\u0327a\u0303o", "coracao"},
		{"  CORAÇÃO \u00a0 da   Casa ", "coracao da casa"},
		{"Сбережения", "сбережения"},
		{"貯金", "貯金"},
		{"", ""},
	}

	for _, tc := range tests {
		if got := textfold.Key(tc.in); got != tc.want {
			t.Errorf("Key(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
