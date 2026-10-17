package domain

import (
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestNewAccount(t *testing.T) {
	tests := []struct {
		name      string
		in        Account
		wantField string
		wantYield YieldMode
	}{
		{name: "checking", in: Account{Name: "Nubank", Class: ClassAsset, Kind: KindChecking}, wantYield: YieldNone},
		{name: "reserve defaults to auto yield", in: Account{Name: "Emergency", Class: ClassAsset, Kind: KindReserve}, wantYield: YieldAuto},
		{name: "category", in: Account{Name: "Food", Class: ClassExpense}, wantYield: YieldNone},
		{name: "kind on category", in: Account{Name: "Food", Class: ClassExpense, Kind: KindChecking}, wantField: "kind"},
		{name: "missing kind on balance account", in: Account{Name: "X", Class: ClassAsset}, wantField: "kind"},
		{name: "liability with asset kind", in: Account{Name: "X", Class: ClassLiability, Kind: KindCash}, wantField: "kind"},
		{name: "unknown class", in: Account{Name: "X", Class: "other"}, wantField: "class"},
		{name: "empty name", in: Account{Name: "  ", Class: ClassExpense}, wantField: "name"},
		{name: "unknown currency", in: Account{Name: "X", Class: ClassExpense, Instrument: "XYZ"}, wantField: "currency"},
		{name: "closed before opened", in: Account{Name: "X", Class: ClassExpense, OpenedOn: day("2026-02-01"), ClosedOn: ptr(day("2026-01-31"))}, wantField: "closed_on"},
		{name: "system role of other class", in: Account{Name: "X", Class: ClassExpense, SystemRole: RoleYield}, wantField: "system_role"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			in := tt.in
			if in.Instrument == "" {
				in.Instrument = "BRL"
			}
			if in.OpenedOn.IsZero() {
				in.OpenedOn = day("2026-01-01")
			}
			got, err := NewAccount(in)
			if tt.wantField != "" {
				requireField(t, err, tt.wantField, ErrValidation)
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if got.YieldMode != tt.wantYield {
				t.Fatalf("YieldMode = %q, want %q", got.YieldMode, tt.wantYield)
			}
		})
	}
}

func TestSystemRolesHaveClasses(t *testing.T) {
	want := map[SystemRole]Class{
		RoleOpeningBalances: ClassEquity, RoleAdjustments: ClassEquity,
		RoleUncategorizedExpense: ClassExpense, RoleInterest: ClassExpense, RoleTaxes: ClassExpense,
		RoleFees: ClassExpense, RoleRealizedLosses: ClassExpense,
		RoleUncategorizedIncome: ClassIncome, RoleYield: ClassIncome, RoleDiscounts: ClassIncome,
		RoleRealizedGains: ClassIncome,
	}
	if len(SystemRoles()) != len(want) {
		t.Fatalf("SystemRoles() has %d roles, want %d", len(SystemRoles()), len(want))
	}
	for _, r := range SystemRoles() {
		if r.Class() != want[r] {
			t.Errorf("%s class = %s, want %s", r, r.Class(), want[r])
		}
	}
}

func TestIsOpenOn(t *testing.T) {
	a := mustAccount(t, Account{Class: ClassExpense, OpenedOn: day("2026-01-01"), ClosedOn: ptr(day("2026-06-30"))})
	for d, want := range map[string]bool{"2025-12-31": false, "2026-01-01": true, "2026-06-30": true, "2026-07-01": false} {
		if got := a.IsOpenOn(day(d)); got != want {
			t.Errorf("IsOpenOn(%s) = %v, want %v", d, got, want)
		}
	}
}

func TestValidateParent(t *testing.T) {
	nubank := uuid.Must(uuid.NewV7())
	itau := uuid.Must(uuid.NewV7())
	checking := mustAccount(t, Account{Class: ClassAsset, Kind: KindChecking, InstitutionID: nubank})
	food := mustAccount(t, Account{Class: ClassExpense})
	income := mustAccount(t, Account{Class: ClassIncome})

	if err := ValidateParent(mustAccount(t, Account{Class: ClassAsset, Kind: KindReserve, InstitutionID: nubank}), checking); err != nil {
		t.Fatalf("reserve under same-institution checking: %v", err)
	}
	if err := ValidateParent(mustAccount(t, Account{Class: ClassExpense}), food); err != nil {
		t.Fatalf("subcategory: %v", err)
	}
	requireField(t, ValidateParent(mustAccount(t, Account{Class: ClassExpense}), income), "parent_id", ErrValidation)
	requireField(t, ValidateParent(mustAccount(t, Account{Class: ClassAsset, Kind: KindReserve, InstitutionID: itau}), checking), "parent_id", ErrValidation)
	requireField(t, ValidateParent(mustAccount(t, Account{Class: ClassAsset, Kind: KindReserve, InstitutionID: nubank, Instrument: "USD"}), checking), "parent_id", ErrValidation)
	requireField(t, ValidateParent(checking, checking), "parent_id", ErrValidation)
	requireField(t, ValidateParent(mustAccount(t, Account{Class: ClassExpense, Instrument: "USD"}), food), "parent_id", ErrValidation)
}

func requireField(t *testing.T, err error, field string, sentinel error) {
	t.Helper()
	fe, ok := errors.AsType[*FieldError](err)
	if !ok || fe.Field != field || !errors.Is(err, sentinel) {
		t.Fatalf("err = %v, want FieldError %q wrapping %v", err, field, sentinel)
	}
}

func ptr[T any](v T) *T { return &v }
