package pluggy_test

import (
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
)

func TestPluggyPortCapabilities(t *testing.T) {
	p, err := pluggy.NewPort("https://pluggy.example", http.DefaultClient, clock.New(time.UTC, func() time.Time { return time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC) }))
	if err != nil {
		t.Fatal(err)
	}
	if p.ID() != "pluggy" {
		t.Errorf("ID = %q", p.ID())
	}
	wantFields := []domain.CredentialField{{Name: "client_id", Secret: false}, {Name: "client_secret", Secret: true}}
	if got := p.CredentialFields(); !slices.Equal(got, wantFields) {
		t.Errorf("CredentialFields = %v", got)
	}
	if p.ConnectMethod() != "reference" {
		t.Errorf("ConnectMethod = %q", p.ConnectMethod())
	}
	if p.MinSyncInterval() != time.Minute {
		t.Errorf("MinSyncInterval = %v", p.MinSyncInterval())
	}
	for status, want := range map[string]domain.ConnectionState{
		"LOGIN_ERROR": domain.StateNeedsOwner, "OUTDATED": domain.StateNeedsOwner, "WAITING_USER_INPUT": domain.StateNeedsOwner,
		"UPDATED": domain.StateOK, "ERROR": domain.StateFailed, "UPDATING": domain.StateFailed,
	} {
		if got := p.State(status); got != want {
			t.Errorf("State(%q) = %q, want %q", status, got, want)
		}
	}
}
