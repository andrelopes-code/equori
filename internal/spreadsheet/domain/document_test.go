package domain

import (
	"errors"
	"strings"
	"testing"
)

func TestNewName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		in, want string
		ok       bool
	}{
		{"Budget", "Budget", true},
		{"  Budget 2027\n", "Budget 2027", true},
		{strings.Repeat("ã", 120), strings.Repeat("ã", 120), true},
		{strings.Repeat("a", 121), "", false},
		{"", "", false},
		{" \t ", "", false},
		{"a\x00b", "", false},
	}
	for _, tt := range tests {
		got, err := NewName(tt.in)
		if got != tt.want || (err == nil) != tt.ok {
			t.Errorf("NewName(%q) = %q, %v; want %q, ok %t", tt.in, got, err, tt.want, tt.ok)
		}

		if err != nil && !errors.Is(err, ErrValidation) {
			t.Errorf("NewName(%q) error %v is not ErrValidation", tt.in, err)
		}
	}
}
