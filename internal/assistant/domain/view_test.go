package domain_test

import (
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
)

func TestValidForm(t *testing.T) {
	cases := []struct {
		form string
		want bool
	}{
		{"ranking", true},
		{"tax_year", true},
		{"r2", true},
		{"Ranking", false},
		{"r", false},
		{"2ranking", false},
		{"rank-ing", false},
		{"r" + strings.Repeat("a", 39), true},
		{"r" + strings.Repeat("a", 40), false},
	}

	for _, c := range cases {
		if got := domain.ValidForm(c.form); got != c.want {
			t.Errorf("ValidForm(%q) = %v, want %v", c.form, got, c.want)
		}
	}
}
