package csvfile

import (
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

func profile(edit func(*domain.Profile)) domain.Profile {
	p := domain.Profile{Delimiter: ",", HeaderRows: 1, DateColumn: "Data", DateLayout: domain.LayoutDayMonthYear,
		AmountColumn: "Valor", DecimalSeparator: ".", GroupSeparator: ",", DescriptionColumn: "Descrição", IDColumn: "Identificador", AmountSign: domain.SignAsIs}
	if edit != nil {
		edit(&p)
	}

	return p
}

func semicolons(edit func(*domain.Profile)) domain.Profile {
	return profile(func(p *domain.Profile) {
		p.Delimiter, p.DecimalSeparator, p.GroupSeparator = ";", ",", "."
		if edit != nil {
			edit(p)
		}
	})
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
			profile(func(p *domain.Profile) {
				p.Delimiter, p.DecimalSeparator, p.GroupSeparator, p.IDColumn = ";", ",", ".", ""
			}), []int64{-123456},
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
		{"footer rows", []byte("Data;Valor;Identificador;Descrição\n05/10/2026;-1,00;a;x\nTOTAL;;;\n\nSaldo;-1,00;;\n"),
			semicolons(func(p *domain.Profile) { p.FooterRows = 2 }), []int64{-100},
			domain.NormalizedRecord{ExternalID: "a", Date: day("2026-10-05"), Description: "x"}},
		{"rows above the header", []byte("Banco X\nConta;123\nData;Valor;Identificador;Descrição\n05/10/2026;-1,00;a;x\n"),
			semicolons(func(p *domain.Profile) { p.HeaderRows = 3 }), []int64{-100},
			domain.NormalizedRecord{ExternalID: "a", Date: day("2026-10-05"), Description: "x"}},
		{"marker after the amount", []byte("Data;Valor;Identificador;Descrição\n05/10/2026;100,00 D;a;x\n06/10/2026;50,00 C;b;y\n07/10/2026;20,00;c;z\n"),
			semicolons(func(p *domain.Profile) { p.DebitMarker = "d" }), []int64{-10000, 5000, 2000},
			domain.NormalizedRecord{ExternalID: "a", Date: day("2026-10-05"), Description: "x"}},
		{"marker column", []byte("Data;Valor;Tipo;Identificador;Descrição\n05/10/2026;100,00;Débito;a;x\n06/10/2026;50,00;CRÉDITO;b;y\n"),
			semicolons(func(p *domain.Profile) { p.SignColumn, p.DebitMarker = "Tipo", "débito" }), []int64{-10000, 5000},
			domain.NormalizedRecord{ExternalID: "a", Date: day("2026-10-05"), Description: "x"}},
		{"marker keeps a written minus", []byte("Data;Valor;Identificador;Descrição\n05/10/2026;-30,00;a;x\n"),
			semicolons(func(p *domain.Profile) { p.DebitMarker = "D" }), []int64{-3000},
			domain.NormalizedRecord{ExternalID: "a", Date: day("2026-10-05"), Description: "x"}},
		{"date with time", []byte("Data;Valor;Identificador;Descrição\n05/10/2026 14:22;1,00;a;x\n"),
			semicolons(nil), []int64{100},
			domain.NormalizedRecord{ExternalID: "a", Date: day("2026-10-05"), Description: "x"}},
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
		{"footer rows do not hide a bad line", "Data,Valor,Identificador,Descrição\nTOTAL,1.00,a,x\n05/10/2026,1.00,b,y\n", "line 2",
			profile(func(p *domain.Profile) { p.FooterRows = 1 })},
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

func TestParseDeclaredEncoding(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		in       []byte
		encoding string
		want     string
	}{
		{"utf-8 bom under windows-1252", []byte("\xef\xbb\xbfData,Valor,Identificador,Descrição\n05/10/2026,-1.00,a1,Café\n"), "windows-1252", "Café"},
		{"windows-1251", []byte("Data,Valor,Identificador,\xce\xef\xe8\xf1\xe0\xed\xe8\xe5\n05/10/2026,-1.00,a1,\xcc\xe0\xe3\xe0\xe7\xe8\xed\n"), "windows-1251", "Магазин"},
	}
	for _, tc := range tests {
		p := profile(func(p *domain.Profile) {
			p.Encoding = tc.encoding
			if tc.encoding == "windows-1251" {
				p.DescriptionColumn = "Описание"
			}
		})

		st, err := Parse(tc.in, p, 2)
		if err != nil || len(st.Records) != 1 || st.Records[0].Description != tc.want {
			t.Errorf("%s: records = %+v, err = %v", tc.name, st.Records, err)
		}
	}
}
