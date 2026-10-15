package domain

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

func brl(t *testing.T, amount int64) money.Money { return mustMoney(t, amount, "BRL") }

func mustMoney(t *testing.T, amount int64, c money.Currency) money.Money {
	t.Helper()
	m, err := money.New(amount, c)
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func mustAccount(t *testing.T, a Account) Account {
	t.Helper()
	if a.ID == uuid.Nil {
		a.ID = uuid.Must(uuid.NewV7())
	}
	if a.UserID == 0 {
		a.UserID = 1
	}
	if a.OpenedOn.IsZero() {
		a.OpenedOn = day("2026-01-01")
	}
	if a.Instrument == "" {
		a.Instrument = "BRL"
	}
	if a.Name == "" {
		a.Name = string(a.Class) + " " + string(a.Kind)
	}
	got, err := NewAccount(a)
	if err != nil {
		t.Fatalf("NewAccount(%+v): %v", a, err)
	}
	return got
}

func accountMap(as ...Account) map[uuid.UUID]Account {
	m := make(map[uuid.UUID]Account, len(as))
	for _, a := range as {
		m[a.ID] = a
	}
	return m
}
