package domain

import (
	"errors"
	"slices"
	"testing"

	"github.com/google/uuid"
)

type categorizeFixture struct {
	checking, card, uncategorized, income, food, cleaning, closed, usdFood, savings Account
	accounts                                                                        map[uuid.UUID]Account
}

func newCategorizeFixture(t *testing.T) categorizeFixture {
	f := categorizeFixture{
		checking:      mustAccount(t, Account{Class: ClassAsset, Kind: KindChecking}),
		card:          mustAccount(t, Account{Class: ClassLiability, Kind: KindCreditCard}),
		uncategorized: mustAccount(t, Account{Class: ClassExpense, SystemRole: RoleUncategorizedExpense, Name: "Uncategorized expense"}),
		income:        mustAccount(t, Account{Class: ClassIncome, SystemRole: RoleUncategorizedIncome, Name: "Uncategorized income"}),
		food:          mustAccount(t, Account{Class: ClassExpense, Name: "Food"}),
		cleaning:      mustAccount(t, Account{Class: ClassExpense, Name: "Cleaning"}),
		closed:        mustAccount(t, Account{Class: ClassExpense, Name: "Old", ClosedOn: ptr(day("2026-02-28"))}),
		usdFood:       mustAccount(t, Account{Class: ClassExpense, Name: "Food USD", Instrument: "USD"}),
		savings:       mustAccount(t, Account{Class: ClassAsset, Kind: KindSavings}),
	}
	f.accounts = accountMap(f.checking, f.card, f.uncategorized, f.income, f.food, f.cleaning, f.closed, f.usdFood, f.savings)
	return f
}

func (f categorizeFixture) record(t *testing.T, postings ...Posting) Transaction {
	t.Helper()
	tx, err := NewTransaction(Transaction{
		ID: uuid.Must(uuid.NewV7()), UserID: 1, Date: day("2026-10-14"), Description: "UBER *TRIP",
		BalancingCurrency: "BRL", Postings: postings, Tags: []string{"work"},
	}, f.accounts)
	if err != nil {
		t.Fatal(err)
	}
	return tx
}

func TestCategoryState(t *testing.T) {
	f := newCategorizeFixture(t)
	tests := []struct {
		name     string
		postings []Posting
		want     CategoryState
	}{
		{"transfer", []Posting{{AccountID: f.checking.ID, Amount: brl(t, -100)}, {AccountID: f.savings.ID, Amount: brl(t, 100)}}, CategoryNone},
		{"uncategorized", []Posting{{AccountID: f.checking.ID, Amount: brl(t, -100)}, {AccountID: f.uncategorized.ID, Amount: brl(t, 100)}}, CategoryUncategorized},
		{"categorized", []Posting{{AccountID: f.checking.ID, Amount: brl(t, -100)}, {AccountID: f.food.ID, Amount: brl(t, 100)}}, CategoryCategorized},
		{"mixed", []Posting{{AccountID: f.checking.ID, Amount: brl(t, -100)}, {AccountID: f.food.ID, Amount: brl(t, 60)}, {AccountID: f.uncategorized.ID, Amount: brl(t, 40)}}, CategoryCategorized},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := f.record(t, tt.postings...).CategoryState(f.accounts); got != tt.want {
				t.Fatalf("CategoryState = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestCategorizeReplacesOnlyCategoryPostings(t *testing.T) {
	f := newCategorizeFixture(t)
	prev := f.record(t, Posting{AccountID: f.checking.ID, Amount: brl(t, -25000), Status: StatusReconciled}, Posting{AccountID: f.uncategorized.ID, Amount: brl(t, 25000)})
	prev.Postings[0].ID = uuid.Must(uuid.NewV7())
	payee := uuid.Must(uuid.NewV7())

	next, err := prev.Categorize(Categorization{
		ExpectedVersion: 1,
		Parts:           []CategoryPart{{AccountID: f.food.ID, Amount: brl(t, 20000)}, {AccountID: f.cleaning.ID, Amount: brl(t, 5000)}},
		PayeeID:         &payee,
		AddTags:         []string{"Groceries", "work"},
	}, f.accounts)
	if err != nil {
		t.Fatal(err)
	}
	if next.Version != 2 || next.PayeeID != payee || !slices.Equal(next.Tags, []string{"groceries", "work"}) {
		t.Fatalf("next = %+v", next)
	}
	if len(next.Postings) != 3 || next.Postings[0] != prev.Postings[0] {
		t.Fatalf("balance-sheet posting changed: %+v", next.Postings)
	}
	for i, want := range []struct {
		account uuid.UUID
		amount  int64
	}{{f.food.ID, 20000}, {f.cleaning.ID, 5000}} {
		p := next.Postings[i+1]
		if p.AccountID != want.account || p.Amount != brl(t, want.amount) || p.Weight != p.Amount || p.Status != StatusCleared {
			t.Fatalf("postings[%d] = %+v", i+1, p)
		}
	}
	if !CategoriesChanged(prev, next, f.accounts) {
		t.Fatal("CategoriesChanged = false")
	}
}

func TestCategorizeKeepsCardPosting(t *testing.T) {
	f := newCategorizeFixture(t)
	prev := f.record(t, Posting{AccountID: f.card.ID, Amount: brl(t, -23000)}, Posting{AccountID: f.uncategorized.ID, Amount: brl(t, 23000)})

	next, err := prev.Categorize(Categorization{ExpectedVersion: 1, Parts: []CategoryPart{{AccountID: f.food.ID, Amount: brl(t, 23000)}}}, f.accounts)
	if err != nil {
		t.Fatal(err)
	}
	if next.Postings[0] != prev.Postings[0] || next.Postings[0].CardRole != RoleCharge {
		t.Fatalf("card posting = %+v, want %+v", next.Postings[0], prev.Postings[0])
	}
}

func TestCategorizeWithoutPartsKeepsPostings(t *testing.T) {
	f := newCategorizeFixture(t)
	prev := f.record(t, Posting{AccountID: f.checking.ID, Amount: brl(t, -100)}, Posting{AccountID: f.uncategorized.ID, Amount: brl(t, 100)})
	payee := uuid.Must(uuid.NewV7())

	next, err := prev.Categorize(Categorization{ExpectedVersion: 1, PayeeID: &payee}, f.accounts)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(next.Postings, prev.Postings) || next.PayeeID != payee || CategoriesChanged(prev, next, f.accounts) {
		t.Fatalf("next = %+v", next)
	}
}

func TestCategorizeRejections(t *testing.T) {
	f := newCategorizeFixture(t)
	uncategorized := func() Transaction {
		return f.record(t, Posting{AccountID: f.checking.ID, Amount: brl(t, -100)}, Posting{AccountID: f.uncategorized.ID, Amount: brl(t, 100)})
	}
	voided := uncategorized()
	voided.VoidedAt = ptr(day("2026-10-15"))
	part := func(a Account, amount int64) []CategoryPart {
		return []CategoryPart{{AccountID: a.ID, Amount: mustMoney(t, amount, a.Instrument)}}
	}
	tests := []struct {
		name  string
		tx    Transaction
		c     Categorization
		err   error
		field string
	}{
		{"voided", voided, Categorization{ExpectedVersion: 1, Parts: part(f.food, 100)}, ErrVoided, ""},
		{"stale version", uncategorized(), Categorization{ExpectedVersion: 2, Parts: part(f.food, 100)}, ErrVersionConflict, ""},
		{"transfer", f.record(t, Posting{AccountID: f.checking.ID, Amount: brl(t, -100)}, Posting{AccountID: f.savings.ID, Amount: brl(t, 100)}),
			Categorization{ExpectedVersion: 1, Parts: part(f.food, 100)}, ErrNotCategorizable, ""},
		{"unknown account", uncategorized(), Categorization{ExpectedVersion: 1, Parts: []CategoryPart{{AccountID: uuid.Must(uuid.NewV7()), Amount: brl(t, 100)}}}, ErrUnknownAccount, "parts[0].account_id"},
		{"balance account", uncategorized(), Categorization{ExpectedVersion: 1, Parts: part(f.savings, 100)}, ErrValidation, "parts[0].account_id"},
		{"closed category", uncategorized(), Categorization{ExpectedVersion: 1, Parts: part(f.closed, 100)}, ErrAccountClosed, "parts[0].account_id"},
		{"other currency", uncategorized(), Categorization{ExpectedVersion: 1, Parts: part(f.usdFood, 100)}, ErrValidation, "parts[0].amount"},
		{"zero amount", uncategorized(), Categorization{ExpectedVersion: 1, Parts: append(part(f.food, 100), CategoryPart{AccountID: f.cleaning.ID, Amount: brl(t, 0)})}, ErrValidation, "parts[1].amount"},
		{"wrong total", uncategorized(), Categorization{ExpectedVersion: 1, Parts: part(f.food, 99)}, ErrValidation, "parts"},
		{"empty parts", uncategorized(), Categorization{ExpectedVersion: 1, Parts: []CategoryPart{}}, ErrValidation, "parts"},
		{"bad tag", uncategorized(), Categorization{ExpectedVersion: 1, AddTags: []string{"#x"}}, ErrValidation, "tags[1]"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := tt.tx.Categorize(tt.c, f.accounts)
			if !errors.Is(err, tt.err) {
				t.Fatalf("err = %v, want %v", err, tt.err)
			}
			if fe, ok := errors.AsType[*FieldError](err); tt.field != "" && (!ok || fe.Field != tt.field) {
				t.Fatalf("err = %v, want field %q", err, tt.field)
			}
		})
	}
}
