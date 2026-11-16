package domain

import (
	"errors"
	"testing"
)

func TestValidateIssuer(t *testing.T) {
	cases := []struct {
		name      string
		scheme    string
		id        string
		want      string
		wantField string
	}{
		{"numeric cnpj with mask", "br_cnpj", "11.222.333/0001-81", "11222333000181", ""},
		{"alphanumeric cnpj lowercase", "br_cnpj", "12.abc.345/01de-35", "12ABC34501DE35", ""},
		{"wrong check digit", "br_cnpj", "11222333000182", "", "issuer.id"},
		{"13 characters", "br_cnpj", "1122233300018", "", "issuer.id"},
		{"letter in a check digit", "br_cnpj", "12ABC34501DE3A", "", "issuer.id"},
		{"unknown scheme", "us_ein", "12-3456789", "", "issuer.scheme"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ValidateIssuer(tc.scheme, tc.id)

			if tc.wantField == "" {
				if err != nil {
					t.Fatalf("err = %v", err)
				}

				if got != tc.want {
					t.Fatalf("id = %q, want %q", got, tc.want)
				}

				return
			}

			var fe *FieldError
			if !errors.As(err, &fe) || fe.Field != tc.wantField {
				t.Fatalf("err = %v, want field %s", err, tc.wantField)
			}
		})
	}
}
