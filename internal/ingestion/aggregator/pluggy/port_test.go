package pluggy_test

import (
	"context"
	"net/http"
	"reflect"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
)

func TestPluggyPortCapabilities(t *testing.T) {
	p, err := pluggy.NewPort("https://pluggy.example", http.DefaultClient, clock.New(func() time.Time { return time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC) }))
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

func TestAccountsHolder(t *testing.T) {
	tests := []struct {
		name      string
		taxNumber string
		want      *domain.PartyID
	}{
		{"cpf", "529.982.247-25", &domain.PartyID{Scheme: "br_cpf", Value: "529.982.247-25"}},
		{"cnpj", "18.236.120/0001-58", &domain.PartyID{Scheme: "br_cnpj", Value: "18.236.120/0001-58"}},
		{"unknown length", "1234567", nil},
		{"empty", "", nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := newPluggyBackend(t)
			b.server.SetAccountTaxNumber(b.account, tt.taxNumber)

			listed, err := b.port.Accounts(context.Background(), uuid.Nil, b.Credentials(), b.ItemID())
			if err != nil {
				t.Fatal(err)
			}

			var reserves int

			for _, a := range listed {
				switch a.ExternalID {
				case conformanceAccount:
					if !reflect.DeepEqual(a.Holder, tt.want) {
						t.Fatalf("Holder = %+v, want %+v", a.Holder, tt.want)
					}
				case conformanceReserve:
					reserves++

					if a.Holder != nil {
						t.Fatalf("reserve Holder = %+v, want nil", a.Holder)
					}
				}
			}

			if reserves != 1 {
				t.Fatalf("listed %d reserves, want 1", reserves)
			}
		})
	}
}
