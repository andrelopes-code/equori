package domain

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestResolveReserve(t *testing.T) {
	t.Parallel()

	house, trip := uuid.New(), uuid.New()
	from := onDate("2026-11-11")

	mapped := func(name string, account uuid.UUID, former ...string) ExternalAccount {
		return ExternalAccount{
			ID: uuid.New(), ExternalID: "id-" + name, Subtype: SubtypeReservedBalance,
			Name: name, FormerNames: former, AccountID: &account, SyncFrom: &from,
		}
	}
	pending := func(name string) ExternalAccount {
		return ExternalAccount{ID: uuid.New(), ExternalID: "id-" + name, Subtype: SubtypeReservedBalance, Name: name}
	}
	ignored := func(name string) ExternalAccount {
		x := pending(name)
		x.Ignored = true

		return x
	}
	dated := func(x ExternalAccount, nameFrom, nameOn string) ExternalAccount {
		f, o := onDate(nameFrom), onDate(nameOn)
		x.NameFrom, x.NameOn = &f, &o

		return x
	}
	gone := func(x ExternalAccount, since string) ExternalAccount {
		d := onDate(since)
		x.GoneSince = &d

		return x
	}

	tests := []struct {
		name     string
		line     NormalizedRecord
		reserves []ExternalAccount
		transfer *uuid.UUID
		review   bool
	}{
		{name: "not a reserve line", line: NormalizedRecord{Date: from}, reserves: []ExternalAccount{mapped("Casa", house)}},
		{
			name:     "exact name",
			line:     move("Casa", "2026-11-12"),
			reserves: []ExternalAccount{mapped("Casa", house)},
			transfer: &house,
		},
		{
			name:     "case, spacing and Unicode form",
			line:     move("  CORAÇÃO   da  casa ", "2026-11-12"),
			reserves: []ExternalAccount{mapped("Coração da Casa", house)},
			transfer: &house,
		},
		{
			name:     "dated before the start date",
			line:     move("Casa", "2026-11-10"),
			reserves: []ExternalAccount{mapped("Casa", house)},
		},
		{
			name:     "former name without a holder",
			line:     move("Viagem", "2026-11-12"),
			reserves: []ExternalAccount{mapped("Casa", house, "Viagem")},
			transfer: &house,
		},
		{
			name:     "pending reserve holds a former name of a mapped one",
			line:     move("Viagem", "2026-11-12"),
			reserves: []ExternalAccount{mapped("Casa", house, "Viagem"), dated(pending("Viagem"), "2026-11-11", "2026-11-12")},
			review:   true,
		},
		{
			name:     "ignored reserve holds the name after its window",
			line:     move("Viagem", "2026-11-13"),
			reserves: []ExternalAccount{mapped("Casa", house, "Viagem"), dated(ignored("Viagem"), "2026-11-11", "2026-11-12")},
		},
		{
			name:     "line before the holder's window goes to the former holder",
			line:     move("Viagem", "2026-11-11"),
			reserves: []ExternalAccount{mapped("Casa", house, "Viagem"), dated(mapped("Viagem", trip), "2026-11-12", "2026-11-13")},
			transfer: &house,
		},
		{
			name:     "line inside the holder's window waits",
			line:     move("Viagem", "2026-11-12"),
			reserves: []ExternalAccount{mapped("Casa", house, "Viagem"), dated(mapped("Viagem", trip), "2026-11-11", "2026-11-12")},
			review:   true,
		},
		{
			name:     "line after the holder's window goes to the holder",
			line:     move("Viagem", "2026-11-14"),
			reserves: []ExternalAccount{mapped("Casa", house, "Viagem"), dated(mapped("Viagem", trip), "2026-11-12", "2026-11-13")},
			transfer: &trip,
		},
		{
			name:     "a holder without dates excludes a former holder",
			line:     move("Viagem", "2026-11-12"),
			reserves: []ExternalAccount{mapped("Casa", house, "Viagem"), mapped("Viagem", trip)},
			transfer: &trip,
		},
		{
			name:     "two mapped holders",
			line:     move("Casa", "2026-11-12"),
			reserves: []ExternalAccount{mapped("Casa", house), mapped("casa", trip)},
			review:   true,
		},
		{
			name:     "two unmapped holders",
			line:     move("Casa", "2026-11-12"),
			reserves: []ExternalAccount{pending("Casa"), ignored("casa"), mapped("Outra", house)},
		},
		{
			name:     "unknown name with a tracked reserve",
			line:     move("Bbb", "2026-11-12"),
			reserves: []ExternalAccount{mapped("Ccc", house, "Aaa")},
			review:   true,
		},
		{
			name:     "unknown name dated before every start date",
			line:     move("Bbb", "2026-11-10"),
			reserves: []ExternalAccount{mapped("Ccc", house)},
		},
		{
			name:     "unknown name without a mapped reserve",
			line:     move("Bbb", "2026-11-12"),
			reserves: []ExternalAccount{pending("Ccc")},
		},
		{
			name:     "a line without a name",
			line:     NormalizedRecord{ReserveMove: true, Date: onDate("2026-11-12")},
			reserves: []ExternalAccount{mapped("Ccc", house)},
			review:   true,
		},
		{
			name:     "a replaced reserve answers to nothing",
			line:     move("Aaa", "2026-11-12"),
			reserves: []ExternalAccount{gone(ignored("Aaa"), "2026-11-12"), mapped("Aaa", house)},
			transfer: &house,
		},
		{
			name:     "a gone reserve holds its name up to the date it left",
			line:     move("Aaa", "2026-11-12"),
			reserves: []ExternalAccount{gone(mapped("Aaa", trip), "2026-11-12"), mapped("Aaa", house)},
			review:   true,
		},
		{
			name:     "a gone reserve answers to nothing after that date",
			line:     move("Aaa", "2026-11-13"),
			reserves: []ExternalAccount{gone(mapped("Aaa", trip), "2026-11-12"), mapped("Aaa", house)},
			transfer: &house,
		},
		{
			name:     "an identifier decides over a name",
			line:     NormalizedRecord{ReserveMove: true, ReserveExternalID: "id-Viagem", ReserveName: "Casa", Date: onDate("2026-11-12")},
			reserves: []ExternalAccount{mapped("Casa", house), mapped("Viagem", trip)},
			transfer: &trip,
		},
		{
			name:     "an unknown identifier waits",
			line:     NormalizedRecord{ReserveMove: true, ReserveExternalID: "id-other", ReserveName: "Casa", Date: onDate("2026-11-12")},
			reserves: []ExternalAccount{mapped("Casa", house)},
			review:   true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := ResolveReserve(tc.line, tc.reserves)

			if got.Review != tc.review {
				t.Fatalf("review = %v, want %v", got.Review, tc.review)
			}

			switch {
			case tc.transfer == nil && got.TransferTo != nil:
				t.Fatalf("transfer = %v, want none", *got.TransferTo)
			case tc.transfer != nil && (got.TransferTo == nil || *got.TransferTo != *tc.transfer):
				t.Fatalf("transfer = %v, want %v", got.TransferTo, *tc.transfer)
			}
		})
	}
}

func move(name, date string) NormalizedRecord {
	return NormalizedRecord{ReserveMove: true, ReserveName: name, Date: onDate(date)}
}

func onDate(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}

	return d
}
