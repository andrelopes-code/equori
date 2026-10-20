package csvfile

import (
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

func profile(edit func(*domain.Profile)) domain.Profile {
	p := domain.Profile{Delimiter: ",", HeaderRows: 1, DateColumn: "Data", DateLayout: domain.LayoutDayMonthYear,
		AmountColumn: "Valor", DecimalSeparator: ".", DescriptionColumn: "Descrição", IDColumn: "Identificador", AmountSign: domain.SignAsIs}
	if edit != nil {
		edit(&p)
	}
	return p
}

func TestParse(t *testing.T) {
	t.Parallel()
	day := func(s string) time.Time { d, _ := time.Parse(time.DateOnly, s); return d }
	tests := []struct {
		name    string
		in      []byte
		p       domain.Profile
		amounts []int64
		first   domain.NormalizedRecord
	}{
		{"amount column", []byte("\xef\xbb\xbfData,Valor,Identificador,Descrição\n05/10/2026,-45.90,a1,Pão de Açúcar\n\n15/10/2026,3000.00,a3,Salário\n"),
			profile(nil), []int64{-4590, 300000}, domain.NormalizedRecord{ExternalID: "a1", Date: day("2026-10-05"), Description: "Pão de Açúcar"}},
		{"brazilian decimals and semicolons", []byte("Data;Valor;Descrição\n07/10/2026;\"-1.234,56\";Aluguel\n"),
			profile(func(p *domain.Profile) { p.Delimiter, p.DecimalSeparator, p.IDColumn = ";", ",", "" }), []int64{-123456},
			domain.NormalizedRecord{Date: day("2026-10-07"), Description: "Aluguel"}},
		{"debit and credit columns", []byte("Data,Histórico,Débito,Crédito\n2026-10-08,Tarifa,12.50,\n2026-10-09,PIX,,100\n"),
			profile(func(p *domain.Profile) {
				p.DateLayout, p.DescriptionColumn, p.AmountColumn, p.DebitColumn, p.CreditColumn, p.IDColumn = domain.LayoutISO, "Histórico", "", "Débito", "Crédito", ""
			}), []int64{-1250, 10000}, domain.NormalizedRecord{Date: day("2026-10-08"), Description: "Tarifa"}},
		{"inverted card export by position", []byte("2026-10-14,SUPERMERCADO,230.00\n2026-10-20,ESTORNO,-230.00\n"),
			profile(func(p *domain.Profile) {
				p.HeaderRows, p.DateLayout, p.DateColumn, p.DescriptionColumn, p.AmountColumn, p.IDColumn, p.AmountSign = 0, domain.LayoutISO, "1", "2", "3", "", domain.SignInverted
			}), []int64{-23000, 23000}, domain.NormalizedRecord{Date: day("2026-10-14"), Description: "SUPERMERCADO"}},
		{"windows-1252", []byte("Data,Valor,Identificador,Descri\xe7\xe3o\n05/10/2026,-1.00,x,Caf\xe9\n"),
			profile(nil), []int64{-100}, domain.NormalizedRecord{ExternalID: "x", Date: day("2026-10-05"), Description: "Café"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			st, err := Parse(tc.in, tc.p, 2)
			if err != nil {
				t.Fatal(err)
			}
			if len(st.Records) != len(tc.amounts) {
				t.Fatalf("records = %+v", st.Records)
			}
			for i, want := range tc.amounts {
				if st.Records[i].Amount != want {
					t.Errorf("record %d amount = %d, want %d", i, st.Records[i].Amount, want)
				}
			}
			f := st.Records[0]
			if f.ExternalID != tc.first.ExternalID || !f.Date.Equal(tc.first.Date) || f.Description != tc.first.Description {
				t.Fatalf("first = %+v", f)
			}
		})
	}
}

func TestParseRejects(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name, in, want string
		p              domain.Profile
	}{
		{"missing column", "Data,Valor,Descrição\n05/10/2026,1.00,x\n", "Identificador", profile(nil)},
		{"bad date", "Data,Valor,Identificador,Descrição\n2026-10-05,1.00,a,x\n", "line 2", profile(nil)},
		{"bad amount", "Data,Valor,Identificador,Descrição\n05/10/2026,abc,a,x\n", "amount", profile(nil)},
		{"no header", "", "header row 1", profile(nil)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Parse([]byte(tc.in), tc.p, 2)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("err = %v, want it to mention %q", err, tc.want)
			}
		})
	}
}
