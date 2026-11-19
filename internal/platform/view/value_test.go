package view_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

func TestShare(t *testing.T) {
	cases := []struct {
		part, total, want int64
	}{
		{320000, 819105, 3907}, // 3906.70 rounds up
		{1, 3, 3333},
		{1, 8, 1250},
		{5, 40000, 1}, // 1.25 rounds down
		{3, 16000, 2}, // 1.875 rounds up
		{1, 20000, 0}, // 0.5 rounds to even 0
		{3, 20000, 2}, // 1.5 rounds to even 2
		{0, 0, 0},
		{-1, 3, -3333},
	}

	for _, c := range cases {
		if got := view.Share(c.part, c.total); got != c.want {
			t.Errorf("Share(%d, %d) = %d, want %d", c.part, c.total, got, c.want)
		}
	}
}

func TestAmount(t *testing.T) {
	m, err := view.Amount("8191.05", "BRL")
	if err != nil || m.Amount != 819105 || m.Currency != "BRL" {
		t.Fatalf("Amount = %+v, %v", m, err)
	}

	if _, err := view.Amount("1.5", "XXX1"); err == nil {
		t.Fatal("an unknown currency parsed")
	}
}
