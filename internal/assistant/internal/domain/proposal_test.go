package domain

import (
	"testing"
	"time"
)

func TestExpired(t *testing.T) {
	t.Parallel()
	at := func(h, m, s int) time.Time { return time.Date(2026, 10, 23, h, m, s, 0, time.UTC) }
	pending := Proposal{Status: ProposalPending, CreatedAt: at(10, 0, 0), ExpiresAt: at(10, 15, 0)}
	executed := pending
	executed.Status = ProposalExecuted
	tests := []struct {
		name string
		p    Proposal
		now  time.Time
		want bool
	}{
		{"before expiry", pending, at(10, 14, 59), false},
		{"at expiry", pending, at(10, 15, 0), true},
		{"executed", executed, at(10, 20, 0), false},
	}
	for _, tt := range tests {
		if got := tt.p.Expired(tt.now); got != tt.want {
			t.Errorf("%s: Expired = %v, want %v", tt.name, got, tt.want)
		}
	}
}
