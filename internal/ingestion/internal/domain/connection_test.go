package domain

import (
	"testing"
	"time"
)

func TestSyncWindow(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		syncFrom     string
		lastSynced   string
		lastDeepRead string
		wantFrom     string
		wantDeep     bool
	}{
		{"first sync", "2026-08-01", "", "", "2026-08-01", true},
		{"deep after 7 days", "2026-08-01", "2026-11-18", "2026-11-12", "2026-08-21", true},
		{"not deep within 7 days", "2026-08-01", "2026-11-18", "2026-11-13", "2026-10-19", false},
		{"deep without a stored re-read", "2026-08-01", "2026-11-18", "", "2026-08-21", true},
		{"deep from a later start", "2026-10-01", "2026-11-18", "2026-11-12", "2026-10-01", true},
		{"daily from a later start", "2026-10-25", "2026-11-18", "2026-11-13", "2026-10-25", false},
	}

	today := mustDate(t, "2026-11-19")

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			syncFrom := mustDate(t, tt.syncFrom)
			a := ExternalAccount{SyncFrom: &syncFrom}

			if tt.lastSynced != "" {
				d := mustDate(t, tt.lastSynced)
				a.LastSyncedOn = &d
			}

			if tt.lastDeepRead != "" {
				d := mustDate(t, tt.lastDeepRead)
				a.LastDeepReadOn = &d
			}

			from, to, deep := a.SyncWindow(today)

			if got := from.Format(time.DateOnly); got != tt.wantFrom {
				t.Errorf("from = %s, want %s", got, tt.wantFrom)
			}

			if !to.Equal(today) {
				t.Errorf("to = %s, want %s", to.Format(time.DateOnly), today.Format(time.DateOnly))
			}

			if deep != tt.wantDeep {
				t.Errorf("deep = %v, want %v", deep, tt.wantDeep)
			}
		})
	}
}

func mustDate(t *testing.T, s string) time.Time {
	t.Helper()

	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		t.Fatal(err)
	}

	return d
}
