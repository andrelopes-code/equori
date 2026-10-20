package ledger

import (
	"errors"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
)

func (f ledgerFixture) balance(t *testing.T, accountID domain.Account, on string, basis app.Basis) int64 {
	t.Helper()
	b, err := f.svc.BalanceAt(t.Context(), f.userID, accountID.ID, date(on), basis)
	if err != nil {
		t.Fatal(err)
	}
	return b.Amount.Amount()
}

func TestBalanceBookedVsSettled(t *testing.T) {
	t.Parallel()
	f := newLedgerFixture(t)
	settled := date("2026-10-19")
	_, err := f.svc.RecordTransaction(t.Context(), f.userID, domain.Transaction{
		Date: date("2026-10-17"),
		Postings: []domain.Posting{
			{AccountID: f.checking.ID, Amount: brl(t, -8000), SettledOn: &settled},
			{AccountID: f.food.ID, Amount: brl(t, 8000)},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	if got := f.balance(t, f.checking, "2026-10-18", app.BasisBooked); got != -8000 {
		t.Fatalf("booked balance on 2026-10-18 = %d, want -8000", got)
	}
	if got := f.balance(t, f.checking, "2026-10-18", app.BasisSettled); got != 0 {
		t.Fatalf("settled balance on 2026-10-18 = %d, want 0", got)
	}
	if got := f.balance(t, f.checking, "2026-10-19", app.BasisSettled); got != -8000 {
		t.Fatalf("settled balance on 2026-10-19 = %d, want -8000", got)
	}
}

func TestBalanceExcludesVoided(t *testing.T) {
	t.Parallel()
	f := newLedgerFixture(t)
	f.expense(t, "2026-10-01", 1000)
	tx := f.expense(t, "2026-10-02", 500)

	if err := f.svc.VoidTransaction(t.Context(), f.userID, tx.ID, "duplicate"); err != nil {
		t.Fatal(err)
	}

	if got := f.balance(t, f.checking, "2026-10-31", app.BasisBooked); got != -1000 {
		t.Fatalf("balance = %d, want -1000 without the voided transaction", got)
	}
}

func TestBalanceAtDateIncludesThatDay(t *testing.T) {
	t.Parallel()
	f := newLedgerFixture(t)
	f.expense(t, "2026-10-14", 2300)

	if got := f.balance(t, f.checking, "2026-10-13", app.BasisBooked); got != 0 {
		t.Fatalf("balance the day before = %d", got)
	}
	if got := f.balance(t, f.checking, "2026-10-14", app.BasisBooked); got != -2300 {
		t.Fatalf("balance on the day = %d", got)
	}
}

func TestParentBalanceSumsChildren(t *testing.T) {
	t.Parallel()
	f := newLedgerFixture(t)
	parent := f.createAccount(t, domain.Account{Name: "Nubank", Class: domain.ClassAsset, Kind: domain.KindChecking})
	child := f.createAccount(t, domain.Account{Name: "Nubank account", Class: domain.ClassAsset, Kind: domain.KindChecking, ParentID: parent.ID})
	reserve := f.createAccount(t, domain.Account{Name: "Emergency", Class: domain.ClassAsset, Kind: domain.KindReserve, ParentID: parent.ID})
	for _, p := range [][2]any{{child, int64(500000)}, {reserve, int64(100000)}} {
		_, err := f.svc.RecordTransaction(t.Context(), f.userID, domain.Transaction{
			Date: date("2026-10-05"),
			Postings: []domain.Posting{
				{AccountID: p[0].(domain.Account).ID, Amount: brl(t, p[1].(int64))},
				{AccountID: f.food.ID, Amount: brl(t, -p[1].(int64))},
			},
		})
		if err != nil {
			t.Fatal(err)
		}
	}

	if got := f.balance(t, parent, "2026-10-31", app.BasisBooked); got != 600000 {
		t.Fatalf("parent balance = %d, want 600000", got)
	}

	_, err := f.svc.RecordTransaction(t.Context(), f.userID, domain.Transaction{
		Date: date("2026-10-06"),
		Postings: []domain.Posting{
			{AccountID: parent.ID, Amount: brl(t, 100)},
			{AccountID: f.food.ID, Amount: brl(t, -100)},
		},
	})
	if fe, ok := errors.AsType[*domain.FieldError](err); !ok || fe.Field != "postings[0].account_id" {
		t.Fatalf("posting on parent err = %v, want field postings[0].account_id", err)
	}
}

func TestBalanceUnknownAccount(t *testing.T) {
	t.Parallel()
	f := newLedgerFixture(t)
	other := provisionedUser(t, f.pool, f.dispatcher)
	if _, err := f.svc.BalanceAt(t.Context(), other, f.checking.ID, time.Now(), app.BasisBooked); !errors.Is(err, app.ErrNotFound) {
		t.Fatalf("balance of another user's account err = %v, want ErrNotFound", err)
	}
}
