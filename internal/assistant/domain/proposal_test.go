package domain

import (
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestExpired(t *testing.T) {
	t.Parallel()

	at := func(h, m, s int) time.Time { return time.Date(2026, 10, 23, h, m, s, 0, time.UTC) }
	pending := Proposal{Status: ProposalPending, CreatedAt: at(10, 0, 0), ExpiresAt: at(10, 15, 0)}
	executed := pending
	executed.Status = ProposalExecuted
	waiting := pending
	waiting.Status = ProposalWaiting

	tests := []struct {
		name string
		p    Proposal
		now  time.Time
		want bool
	}{
		{"before expiry", pending, at(10, 14, 59), false},
		{"at expiry", pending, at(10, 15, 0), true},
		{"executed", executed, at(10, 20, 0), false},
		{"waiting before expiry", waiting, at(10, 14, 59), false},
		{"waiting at expiry", waiting, at(10, 15, 0), true},
	}
	for _, tt := range tests {
		if got := tt.p.Expired(tt.now); got != tt.want {
			t.Errorf("%s: Expired = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestWaitingFor(t *testing.T) {
	t.Parallel()

	id1, id2 := uuid.MustParse("00000000-0000-0000-0000-000000000001"), uuid.MustParse("00000000-0000-0000-0000-000000000002")
	p := Proposal{Refs: map[string]string{"/b": id2.String(), "/a": id1.String() + "#/x", "/c": id1.String()}}

	if got, want := p.WaitingFor(), []uuid.UUID{id1, id2}; !slices.Equal(got, want) {
		t.Errorf("WaitingFor = %v, want %v", got, want)
	}

	if got := (Proposal{}).WaitingFor(); len(got) != 0 {
		t.Errorf("WaitingFor without refs = %v, want none", got)
	}
}
