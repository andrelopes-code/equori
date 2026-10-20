package domain

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

type txFixture struct {
	checking, food, wise, closed Account
	accounts                     map[uuid.UUID]Account
}

func newTxFixture(t *testing.T) txFixture {
	f := txFixture{
		checking: mustAccount(t, Account{Class: ClassAsset, Kind: KindChecking}),
		food:     mustAccount(t, Account{Class: ClassExpense}),
		wise:     mustAccount(t, Account{Class: ClassAsset, Kind: KindChecking, Instrument: "USD"}),
		closed:   mustAccount(t, Account{Class: ClassAsset, Kind: KindCash, ClosedOn: ptr(day("2026-02-28"))}),
	}
	f.accounts = accountMap(f.checking, f.food, f.wise, f.closed)
	return f
}

func (f txFixture) tx(postings ...Posting) Transaction {
	return Transaction{
		UserID:            1,
		Date:              day("2026-10-14"),
		Description:       "Supermarket",
		BalancingCurrency: "BRL",
		Postings:          postings,
	}
}

func TestNewTransactionBalanced(t *testing.T) {
	t.Parallel()
	f := newTxFixture(t)
	got, err := NewTransaction(f.tx(
		Posting{AccountID: f.checking.ID, Amount: brl(t, -23000)},
		Posting{AccountID: f.food.ID, Amount: brl(t, 23000)},
	), f.accounts)
	if err != nil {
		t.Fatal(err)
	}
	for i, p := range got.Postings {
		if p.Weight != p.Amount {
			t.Errorf("postings[%d] weight %v != amount %v", i, p.Weight, p.Amount)
		}
		if p.Status != StatusCleared {
			t.Errorf("postings[%d] status = %q, want cleared", i, p.Status)
		}
	}
	if got.Version != 1 || got.Origin != OriginManual {
		t.Fatalf("version %d origin %q", got.Version, got.Origin)
	}
}

func TestNewTransactionRejections(t *testing.T) {
	t.Parallel()
	f := newTxFixture(t)
	usd := func(a int64) money.Money { return mustMoney(t, a, "USD") }
	tests := []struct {
		name     string
		tx       Transaction
		field    string
		sentinel error
	}{
		{name: "unbalanced", tx: f.tx(Posting{AccountID: f.checking.ID, Amount: brl(t, -9000)}, Posting{AccountID: f.food.ID, Amount: brl(t, 10000)}), field: "postings", sentinel: ErrUnbalanced},
		{name: "one posting", tx: f.tx(Posting{AccountID: f.checking.ID, Amount: brl(t, -9000)}), field: "postings", sentinel: ErrTooFewPostings},
		{name: "zero amount", tx: f.tx(Posting{AccountID: f.checking.ID, Amount: brl(t, 0)}, Posting{AccountID: f.food.ID, Amount: brl(t, 0)}), field: "postings[0].amount", sentinel: ErrValidation},
		{name: "amount currency differs from account", tx: f.tx(Posting{AccountID: f.checking.ID, Amount: usd(-100)}, Posting{AccountID: f.food.ID, Amount: brl(t, 100)}), field: "postings[0].amount", sentinel: ErrValidation},
		{name: "weight differs on base currency account", tx: f.tx(Posting{AccountID: f.checking.ID, Amount: brl(t, -100), Weight: brl(t, -90)}, Posting{AccountID: f.food.ID, Amount: brl(t, 100)}), field: "postings[0].weight", sentinel: ErrCurrencyMismatch},
		{name: "missing weight on foreign account", tx: f.tx(Posting{AccountID: f.wise.ID, Amount: usd(100000)}, Posting{AccountID: f.checking.ID, Amount: brl(t, -548300)}), field: "postings[0].weight", sentinel: ErrValidation},
		{name: "weight sign opposite to amount", tx: f.tx(Posting{AccountID: f.wise.ID, Amount: usd(100000), Weight: brl(t, -548300)}, Posting{AccountID: f.checking.ID, Amount: brl(t, 548300)}), field: "postings[0].weight", sentinel: ErrValidation},
		{name: "account closed", tx: f.tx(Posting{AccountID: f.closed.ID, Amount: brl(t, -100)}, Posting{AccountID: f.food.ID, Amount: brl(t, 100)}), field: "postings[0].account_id", sentinel: ErrAccountClosed},
		{name: "unknown account", tx: f.tx(Posting{AccountID: uuid.Must(uuid.NewV7()), Amount: brl(t, -100)}, Posting{AccountID: f.food.ID, Amount: brl(t, 100)}), field: "postings[0].account_id", sentinel: ErrUnknownAccount},
		{name: "description too long", tx: func() Transaction {
			tx := f.tx(Posting{AccountID: f.checking.ID, Amount: brl(t, -100)}, Posting{AccountID: f.food.ID, Amount: brl(t, 100)})
			tx.Description = strings.Repeat("x", 501)
			return tx
		}(), field: "description", sentinel: ErrValidation},
		{name: "invalid tag", tx: func() Transaction {
			tx := f.tx(Posting{AccountID: f.checking.ID, Amount: brl(t, -100)}, Posting{AccountID: f.food.ID, Amount: brl(t, 100)})
			tx.Tags = []string{"café!"}
			return tx
		}(), field: "tags[0]", sentinel: ErrValidation},
		{name: "unknown link type", tx: func() Transaction {
			tx := f.tx(Posting{AccountID: f.checking.ID, Amount: brl(t, -100)}, Posting{AccountID: f.food.ID, Amount: brl(t, 100)})
			tx.Links = []Link{{Type: "paid_by", Target: uuid.Must(uuid.NewV7())}}
			return tx
		}(), field: "links[0].type", sentinel: ErrValidation},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewTransaction(tt.tx, f.accounts)
			requireField(t, err, tt.field, tt.sentinel)
		})
	}
}

func TestNewTransactionPostingLimit(t *testing.T) {
	t.Parallel()
	f := newTxFixture(t)
	postings := make([]Posting, 0, MaxPostings+2)
	for range MaxPostings/2 + 1 {
		postings = append(postings, Posting{AccountID: f.checking.ID, Amount: brl(t, -1)}, Posting{AccountID: f.food.ID, Amount: brl(t, 1)})
	}
	_, err := NewTransaction(f.tx(postings...), f.accounts)
	requireField(t, err, "postings", ErrValidation)
}

func TestNewTransactionForeignCurrency(t *testing.T) {
	t.Parallel()
	f := newTxFixture(t)
	got, err := NewTransaction(f.tx(
		Posting{AccountID: f.checking.ID, Amount: brl(t, -548300)},
		Posting{AccountID: f.wise.ID, Amount: mustMoney(t, 100000, "USD"), Weight: brl(t, 548300)},
	), f.accounts)
	if err != nil {
		t.Fatal(err)
	}
	if got.Postings[1].Weight != brl(t, 548300) {
		t.Fatalf("weight = %v", got.Postings[1].Weight)
	}
}

func TestTagsAreNormalized(t *testing.T) {
	t.Parallel()
	f := newTxFixture(t)
	tx := f.tx(Posting{AccountID: f.checking.ID, Amount: brl(t, -100)}, Posting{AccountID: f.food.ID, Amount: brl(t, 100)})
	tx.Tags = []string{"Trip Lisbon", "trip-lisbon", "work"}
	got, err := NewTransaction(tx, f.accounts)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(got.Tags, ",") != "trip-lisbon,work" {
		t.Fatalf("tags = %v", got.Tags)
	}
}

func recorded(t *testing.T, f txFixture) Transaction {
	t.Helper()
	tx := f.tx(Posting{AccountID: f.checking.ID, Amount: brl(t, -100)}, Posting{AccountID: f.food.ID, Amount: brl(t, 100)})
	tx.ID = uuid.Must(uuid.NewV7())
	got, err := NewTransaction(tx, f.accounts)
	if err != nil {
		t.Fatal(err)
	}
	return got
}

func TestCorrect(t *testing.T) {
	t.Parallel()
	f := newTxFixture(t)
	orig := recorded(t, f)
	next := f.tx(Posting{AccountID: f.checking.ID, Amount: brl(t, -3200)}, Posting{AccountID: f.food.ID, Amount: brl(t, 3200)})

	got, err := orig.Correct(next, 1, f.accounts)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != orig.ID || got.Version != 2 || got.Postings[0].Amount != brl(t, -3200) {
		t.Fatalf("corrected = %+v", got)
	}

	if _, err := orig.Correct(next, 2, f.accounts); !errors.Is(err, ErrVersionConflict) {
		t.Fatalf("stale version err = %v", err)
	}

	reconciled := orig
	reconciled.Postings = append([]Posting(nil), orig.Postings...)
	reconciled.Postings[0].Status = StatusReconciled
	if _, err := reconciled.Correct(next, 1, f.accounts); !errors.Is(err, ErrReconciled) {
		t.Fatalf("reconciled err = %v", err)
	}

	voided, err := orig.Void(time.Now(), "duplicate")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := voided.Correct(next, 1, f.accounts); !errors.Is(err, ErrVoided) {
		t.Fatalf("voided correct err = %v", err)
	}
	if _, err := voided.Void(time.Now(), "again"); !errors.Is(err, ErrVoided) {
		t.Fatalf("void twice err = %v", err)
	}
}
