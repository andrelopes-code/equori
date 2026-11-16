package domain

import (
	"errors"
	"strings"
	"testing"
)

func TestValidateInstrumentIssuer(t *testing.T) {
	cases := []struct {
		name       string
		issuer     Issuer
		wantIssuer Issuer
		wantField  string
	}{
		{"name is trimmed", Issuer{Name: "  Banco X  "}, Issuer{Name: "Banco X"}, ""},
		{"name of 81 characters", Issuer{Name: strings.Repeat("a", 81)}, Issuer{}, "issuer.name"},
		{"scheme without id", Issuer{Name: "Banco X", Scheme: "br_cnpj"}, Issuer{}, "issuer.id"},
		{
			"id without name",
			Issuer{Scheme: "br_cnpj", ID: "11222333000181"},
			Issuer{},
			"issuer.name",
		},
		{
			"cnpj is normalized",
			Issuer{Name: "Banco X", Scheme: "br_cnpj", ID: "11.222.333/0001-81"},
			Issuer{Name: "Banco X", Scheme: "br_cnpj", ID: "11222333000181"},
			"",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			in := Instrument{
				Code: "RF.280302.CS3YS", Type: TypeFixedIncome, Scale: 2, Name: "CDB Banco X",
				QuoteCurrency: "BRL", Issuer: tc.issuer,
			}

			got, err := in.Validate()

			if tc.wantField != "" {
				var fe *FieldError
				if !errors.As(err, &fe) || fe.Field != tc.wantField {
					t.Fatalf("err = %v, want field %s", err, tc.wantField)
				}

				return
			}

			if err != nil {
				t.Fatalf("err = %v", err)
			}

			if got.Issuer != tc.wantIssuer {
				t.Fatalf("issuer = %+v, want %+v", got.Issuer, tc.wantIssuer)
			}
		})
	}
}

func TestVisibleTo(t *testing.T) {
	cases := []struct {
		name    string
		booksID int64
		caller  int64
		want    bool
	}{
		{"public", 0, 7, true},
		{"own", 7, 7, true},
		{"another book", 7, 8, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := Instrument{BooksID: tc.booksID}.VisibleTo(tc.caller)

			if got != tc.want {
				t.Fatalf("VisibleTo(%d) = %v, want %v", tc.caller, got, tc.want)
			}
		})
	}
}
