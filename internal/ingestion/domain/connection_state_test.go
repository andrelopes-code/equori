package domain

import (
	"testing"
	"time"
)

func TestConnectionStateAt(t *testing.T) {
	t.Parallel()

	now := mustInstant(t, "2026-11-12T12:00:00Z")

	tests := []struct {
		name        string
		base        ConnectionState
		itemUpdate  string
		lastSynced  string
		consentEnds string
		want        ConnectionState
	}{
		{"aggregator needs the owner", StateNeedsOwner, "2026-11-12T12:00:00Z", "2026-11-12T12:00:00Z", "", StateNeedsOwner},
		{"consent expired", StateOK, "2026-11-12T12:00:00Z", "2026-11-12T12:00:00Z", "2026-11-11T00:00:00Z", StateNeedsOwner},
		{"failed wins over stalled", StateFailed, "2026-11-01T00:00:00Z", "2026-11-12T12:00:00Z", "", StateFailed},
		{"item update 73 hours old", StateOK, "2026-11-09T11:00:00Z", "2026-11-12T12:00:00Z", "", StateStalled},
		{"item update 71 hours old", StateOK, "2026-11-09T13:00:00Z", "2026-11-12T12:00:00Z", "", StateOK},
		{"item update exactly 72 hours old", StateOK, "2026-11-09T12:00:00Z", "2026-11-12T12:00:00Z", "", StateOK},
		{"last sync 73 hours old", StateOK, "2026-11-12T12:00:00Z", "2026-11-09T11:00:00Z", "", StateStalled},
		{"no instants", StateOK, "", "", "", StateOK},
		{"consent in 13 days", StateOK, "2026-11-12T12:00:00Z", "2026-11-12T12:00:00Z", "2026-11-25T12:00:00Z", StateConsentExpiring},
		{"consent in exactly 14 days", StateOK, "2026-11-12T12:00:00Z", "2026-11-12T12:00:00Z", "2026-11-26T12:00:00Z", StateConsentExpiring},
		{"consent in 15 days", StateOK, "2026-11-12T12:00:00Z", "2026-11-12T12:00:00Z", "2026-11-27T12:00:00Z", StateOK},
		{"stalled wins over expiring", StateOK, "2026-11-09T11:00:00Z", "2026-11-12T12:00:00Z", "2026-11-25T12:00:00Z", StateStalled},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			c := Connection{
				LastItemUpdateAt: optInstant(t, tt.itemUpdate),
				LastSyncedAt:     optInstant(t, tt.lastSynced),
				ConsentExpiresAt: optInstant(t, tt.consentEnds),
			}

			if got := c.StateAt(tt.base, now); got != tt.want {
				t.Fatalf("StateAt(%s) = %s, want %s", tt.base, got, tt.want)
			}
		})
	}
}

func optInstant(t *testing.T, v string) *time.Time {
	t.Helper()

	if v == "" {
		return nil
	}

	at := mustInstant(t, v)

	return &at
}

func mustInstant(t *testing.T, v string) time.Time {
	t.Helper()

	at, err := time.Parse(time.RFC3339, v)
	if err != nil {
		t.Fatal(err)
	}

	return at
}
