package domain_test

import (
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

func TestExpired(t *testing.T) {
	t.Parallel()
	at := func(h, m, s int) time.Time { return time.Date(2026, 10, 23, h, m, s, 0, time.UTC) }
	pending := domain.Proposal{Status: domain.ProposalPending, CreatedAt: at(10, 0, 0), ExpiresAt: at(10, 15, 0)}
	executed := pending
	executed.Status = domain.ProposalExecuted
	tests := []struct {
		name string
		p    domain.Proposal
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
