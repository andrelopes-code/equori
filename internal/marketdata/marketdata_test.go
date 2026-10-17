package marketdata_test

import (
	"errors"
	"testing"

	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func TestCurrenciesMatchMoneyPackage(t *testing.T) {
	m := marketdata.New(pgtest.New(t))

	rows, err := m.Currencies(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != len(money.Currencies()) {
		t.Fatalf("instrument currencies = %d, money currencies = %d", len(rows), len(money.Currencies()))
	}
	for _, r := range rows {
		c, err := money.ParseCurrency(string(r.Code))
		if err != nil {
			t.Fatalf("instrument %s unknown to money: %v", r.Code, err)
		}
		if c.MinorUnits() != r.Scale {
			t.Errorf("%s scale = %d, money minor units = %d", r.Code, r.Scale, c.MinorUnits())
		}
	}
}

func TestInstrument(t *testing.T) {
	m := marketdata.New(pgtest.New(t))

	brl, err := m.Instrument(t.Context(), "BRL")
	if err != nil || brl.Type != "currency" || brl.Scale != 2 {
		t.Fatalf("Instrument(BRL) = %+v, %v", brl, err)
	}
	if _, err := m.Instrument(t.Context(), "XYZ"); !errors.Is(err, marketdata.ErrUnknownInstrument) {
		t.Fatalf("Instrument(XYZ) err = %v, want ErrUnknownInstrument", err)
	}
}
