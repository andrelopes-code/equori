// Package aggregatortest holds the contract every aggregator meets (A211, S348).
package aggregatortest

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/textfold"
)

const scale = 2

var integration = uuid.MustParse("01900000-0000-7000-8000-000000000001")

// Backend is one aggregator over its fake server, with one item that lists one bank account
// and, when HasReserves holds, one reserved balance of that account.
type Backend interface {
	Aggregator() app.Aggregator
	Credentials() domain.Credentials
	ItemID() string
	AccountID() string
	// RenameAccount makes the item report the account under name.
	RenameAccount(name string)
	// RemoveAccount makes the item stop listing the account.
	RemoveAccount()
	// AddLine adds an ordinary line dated 2026-11-12 to the account.
	AddLine(id string)

	HasReserves() bool
	ReserveID() string
	RenameReserve(name string)
	// AddReserveLine adds a line dated 2026-11-12 that the source states moves money into the
	// reserve, in the source's own form, naming it as name when the source names it.
	AddReserveLine(id, name string)
	// AddUnreadableReserveLine adds a line the source states moves money to a reserve, in a form
	// the aggregator cannot read a name from.
	AddUnreadableReserveLine(id string)
}

// Run checks the contract of A211 on a new backend per clause.
func Run(t *testing.T, backend func(t *testing.T) Backend) {
	t.Helper()

	t.Run("lists unique non-empty identifiers", func(t *testing.T) {
		seen := map[string]bool{}
		for _, a := range accounts(t, backend(t)) {
			if a.ExternalID == "" || seen[a.ExternalID] {
				t.Fatalf("external id %q is empty or repeated", a.ExternalID)
			}

			seen[a.ExternalID] = true
		}
	})
	t.Run("a rename keeps the identifier and reports the new name", func(t *testing.T) {
		b := backend(t)
		b.RenameAccount("New name")

		if got := find(t, accounts(t, b), b.AccountID()); got.Name != "New name" {
			t.Fatalf("name = %q, want New name", got.Name)
		}
	})
	t.Run("an account no longer listed reads as gone", func(t *testing.T) {
		b := backend(t)
		id := b.AccountID()
		b.RemoveAccount()

		_, err := read(t, b, id)
		if !errors.Is(err, app.ErrAccountGone) || errors.Is(err, app.ErrAggregatorUnavailable) {
			t.Fatalf("read = %v, want ErrAccountGone alone", err)
		}
	})
	t.Run("an ordinary line is no reserve move", func(t *testing.T) {
		b := backend(t)
		b.AddLine("ordinary")

		if got := line(t, b, "ordinary"); got.ReserveMove || got.ReserveName != "" || got.ReserveExternalID != "" {
			t.Fatalf("line = %+v, want no reserve", got)
		}
	})
	runReserves(t, backend)
}

func runReserves(t *testing.T, backend func(t *testing.T) Backend) {
	t.Helper()

	if !backend(t).HasReserves() {
		return
	}

	t.Run("a reserve rename keeps the identifier", func(t *testing.T) {
		b := backend(t)
		b.RenameReserve("New reserve")

		got := find(t, accounts(t, b), b.ReserveID())
		if got.Name != "New reserve" || got.Subtype != domain.SubtypeReservedBalance {
			t.Fatalf("reserve = %+v", got)
		}
	})
	t.Run("a reserve line identifies its reserve", func(t *testing.T) {
		b := backend(t)
		b.RenameReserve("Renamed reserve")
		b.AddReserveLine("reserve-line", "Renamed reserve")

		got := line(t, b, "reserve-line")
		if !got.ReserveMove {
			t.Fatalf("line = %+v, want a reserve move", got)
		}

		byID := got.ReserveExternalID == b.ReserveID()
		if !byID && textfold.Key(got.ReserveName) != textfold.Key("Renamed reserve") {
			t.Fatalf("line = %+v, want the reserve's id or name", got)
		}
	})
	t.Run("an unreadable reserve line is still a reserve move", func(t *testing.T) {
		b := backend(t)
		b.AddUnreadableReserveLine("unreadable")

		if got := line(t, b, "unreadable"); !got.ReserveMove || got.ReserveName != "" || got.ReserveExternalID != "" {
			t.Fatalf("line = %+v, want a reserve move without a name", got)
		}
	})
}

func accounts(t *testing.T, b Backend) []domain.ExternalAccount {
	t.Helper()

	listed, err := b.Aggregator().Accounts(context.Background(), integration, b.Credentials(), b.ItemID())
	if err != nil {
		t.Fatal(err)
	}

	return listed
}

func find(t *testing.T, listed []domain.ExternalAccount, id string) domain.ExternalAccount {
	t.Helper()

	for _, a := range listed {
		if a.ExternalID == id {
			return a
		}
	}

	t.Fatalf("no external account %q in %+v", id, listed)

	return domain.ExternalAccount{}
}

func read(t *testing.T, b Backend, id string) (domain.AccountRead, error) {
	t.Helper()

	from := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 11, 30, 0, 0, 0, 0, time.UTC)

	return b.Aggregator().ReadAccount(context.Background(), integration, b.Credentials(), b.ItemID(), id, from, to, nil, scale)
}

func line(t *testing.T, b Backend, id string) domain.NormalizedRecord {
	t.Helper()

	got, err := read(t, b, b.AccountID())
	if err != nil {
		t.Fatal(err)
	}

	for _, r := range got.Records {
		if r.ExternalID == id {
			return r
		}
	}

	t.Fatalf("no line %q in the read", id)

	return domain.NormalizedRecord{}
}
