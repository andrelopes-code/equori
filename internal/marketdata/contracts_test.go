package marketdata_test

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

var contractApplication = uuid.MustParse("0192f3a4-5b6c-7d8e-9f00-112233445566")

func TestCheckContractDefaults(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	tests := []struct {
		name         string
		edit         func(c *marketdata.Contract)
		wantCode     string
		wantPercent  int
		wantDayCount string
		wantCalendar string
		wantName     string
	}{
		{
			name:         "CDI",
			edit:         func(c *marketdata.Contract) { c.IndexID = "cdi" },
			wantCode:     "RF.280302.CS3YS",
			wantPercent:  10000,
			wantDayCount: "bus252",
			wantName:     "CDB Banco X 2028-03-02",
		},
		{
			name:         "pre-fixed BR",
			edit:         func(c *marketdata.Contract) { c.SpreadBP = 1200 },
			wantCode:     "RF.280302.CS3YS",
			wantDayCount: "bus252",
			wantCalendar: "br_banking",
			wantName:     "CDB Banco X 2028-03-02",
		},
		{
			name: "pre-fixed DE",
			edit: func(c *marketdata.Contract) {
				c.SpreadBP = 1200
				c.Region = "DE"
			},
			wantCode:     "RF.280302.CS3YS",
			wantDayCount: "act365",
			wantName:     "CDB Banco X 2028-03-02",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			c := baseContract()
			tc.edit(&c)

			got, err := h.App.Marketdata.CheckContract(
				t.Context(), h.OwnerID(), c, contractApplication,
			)
			if err != nil {
				t.Fatal(err)
			}

			if string(got.Code) != tc.wantCode || got.PercentOfIndexBP != tc.wantPercent ||
				got.DayCount != tc.wantDayCount || got.CalendarID != tc.wantCalendar ||
				got.Name != tc.wantName {
				t.Fatalf("contract = %+v", got)
			}
		})
	}
}

func TestCheckContractFieldErrors(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	tests := []struct {
		name      string
		edit      func(c *marketdata.Contract)
		wantField string
	}{
		{
			name: "matures before issued",
			edit: func(c *marketdata.Contract) {
				c.MaturesOn = day("2026-03-01")
			},
			wantField: "contract.matures_on",
		},
		{
			name: "invalid issuer id",
			edit: func(c *marketdata.Contract) {
				c.IssuerScheme, c.IssuerID = "br_cnpj", "11222333000182"
			},
			wantField: "contract.issuer.id",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			c := baseContract()
			c.IndexID = "cdi"
			tc.edit(&c)

			_, err := h.App.Marketdata.CheckContract(
				t.Context(), h.OwnerID(), c, contractApplication,
			)

			var fe *domain.FieldError
			if !errors.As(err, &fe) || fe.Field != tc.wantField {
				t.Fatalf("err = %v, want field %s", err, tc.wantField)
			}
		})
	}
}

func TestDefineContract(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	md := h.App.Marketdata
	ctx := t.Context()

	c := baseContract()
	c.IndexID = "cdi"

	c, err := md.CheckContract(ctx, h.OwnerID(), c, contractApplication)
	if err != nil {
		t.Fatal(err)
	}

	if err := md.DefineContract(ctx, h.OwnerID(), c); err != nil {
		t.Fatal(err)
	}

	in, err := md.Instrument(ctx, "RF.280302.CS3YS")
	if err != nil {
		t.Fatal(err)
	}

	if in.BooksID != h.OwnerID() || in.Scale != 6 || in.QuoteCurrency != "BRL" ||
		in.Subtype != "cdb" {
		t.Fatalf("instrument = %+v", in)
	}

	terms, err := md.Terms(ctx, "RF.280302.CS3YS")
	if err != nil {
		t.Fatal(err)
	}

	if terms.FaceValue != 100 || terms.PercentOfIndexBP != 10000 || terms.DayCount != "bus252" {
		t.Fatalf("terms = %+v", terms)
	}
}

func TestDefineContractDiscardsTheInstrumentWhenTheTermsFail(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	md := h.App.Marketdata

	c := baseContract()
	c.Region = "DE"

	c, err := md.CheckContract(t.Context(), h.OwnerID(), c, contractApplication)
	if err != nil {
		t.Fatal(err)
	}

	c.DayCount = "bus252" // no daily index and no calendar: PutTerms refuses

	if err := md.DefineContract(t.Context(), h.OwnerID(), c); err == nil {
		t.Fatal("DefineContract accepted terms that PutTerms refuses")
	}

	if _, err := md.Instrument(t.Context(), string(c.Code)); !errors.Is(
		err, marketdata.ErrUnknownInstrument,
	) {
		t.Fatalf("Instrument err = %v, want ErrUnknownInstrument", err)
	}
}

func TestDiscardContract(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	md := h.App.Marketdata
	ctx := t.Context()

	unused := defineCDI(t, h, contractApplication)
	used := defineCDI(t, h, uuid.MustParse("0192f3a4-5b6c-7d8e-9f00-aabbccddeeff"))

	if _, err := h.Pool.Exec(ctx, `INSERT INTO ledger_account
		(books_id, name, account_class, kind, instrument, opened_on)
		VALUES ($1, 'XP', 'asset', 'brokerage', $2, '2026-01-01')`,
		h.OwnerID(), string(used)); err != nil {
		t.Fatal(err)
	}

	if err := md.DiscardContract(ctx, h.OwnerID(), unused); err != nil {
		t.Fatal(err)
	}

	if _, err := md.Instrument(ctx, string(unused)); !errors.Is(
		err, marketdata.ErrUnknownInstrument,
	) {
		t.Fatalf("unused: err = %v, want ErrUnknownInstrument", err)
	}

	if err := md.DiscardContract(ctx, h.OwnerID(), used); err != nil {
		t.Fatalf("used: err = %v, want nil", err)
	}

	if _, err := md.Instrument(ctx, string(used)); err != nil {
		t.Fatalf("used: instrument err = %v, want it kept", err)
	}
}

// defineCDI checks and defines a CDI contract of the owner's book and returns its code.
func defineCDI(t *testing.T, h *apitest.Harness, application uuid.UUID) money.Currency {
	t.Helper()

	c := baseContract()
	c.IndexID = "cdi"

	c, err := h.App.Marketdata.CheckContract(t.Context(), h.OwnerID(), c, application)
	if err != nil {
		t.Fatal(err)
	}

	if err := h.App.Marketdata.DefineContract(t.Context(), h.OwnerID(), c); err != nil {
		t.Fatal(err)
	}

	return c.Code
}

func baseContract() marketdata.Contract {
	return marketdata.Contract{
		Currency:   "BRL",
		Subtype:    "cdb",
		IssuerName: "Banco X",
		IssuedOn:   day("2026-03-02"),
		MaturesOn:  day("2028-03-02"),
		Region:     "BR",
	}
}
