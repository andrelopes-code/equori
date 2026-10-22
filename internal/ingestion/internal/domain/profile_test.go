package domain

import (
	"errors"
	"testing"
)

func TestNewProfile(t *testing.T) {
	t.Parallel()
	base := Profile{HeaderRows: 1, DateColumn: "Data", DateLayout: LayoutDayMonthYear, AmountColumn: "Valor", DecimalSeparator: ",", DescriptionColumn: "Descrição"}
	p, err := NewProfile(base)
	if err != nil || p.Delimiter != "," || p.AmountSign != SignAsIs {
		t.Fatalf("defaults: %+v, %v", p, err)
	}
	tests := []struct {
		name  string
		edit  func(*Profile)
		field string
	}{
		{"amount and debit columns", func(p *Profile) { p.DebitColumn, p.CreditColumn = "D", "C" }, "amount_column"},
		{"no amount column", func(p *Profile) { p.AmountColumn = "" }, "amount_column"},
		{"debit without credit", func(p *Profile) { p.AmountColumn, p.DebitColumn = "", "D" }, "credit_column"},
		{"encoding pattern", func(p *Profile) { p.Encoding = "Windows 1252" }, "encoding"},
		{"delimiter", func(p *Profile) { p.Delimiter = ":" }, "delimiter"},
		{"layout repeats the day", func(p *Profile) { p.DateLayout = "DD/DD/YYYY" }, "date_layout"},
		{"layout mixes separators", func(p *Profile) { p.DateLayout = "DD/MM-YYYY" }, "date_layout"},
		{"layout lacks the year", func(p *Profile) { p.DateLayout = "DD/MM/MM" }, "date_layout"},
		{"group separator", func(p *Profile) { p.GroupSeparator = ";" }, "group_separator"},
		{"group separator equals the decimal separator", func(p *Profile) { p.GroupSeparator = "," }, "group_separator"},
		{"position without header", func(p *Profile) { p.HeaderRows = 0 }, "date_column"},
		{"description required", func(p *Profile) { p.DescriptionColumn = "" }, "description_column"},
	}
	for _, tc := range tests {
		p := base
		tc.edit(&p)
		_, err := NewProfile(p)
		var fe *FieldError
		if !errors.As(err, &fe) || fe.Field != tc.field || !errors.Is(err, ErrValidation) {
			t.Errorf("%s: err = %v, want field %s", tc.name, err, tc.field)
		}
	}
	positional := Profile{DateColumn: "1", DateLayout: LayoutISO, DebitColumn: "3", CreditColumn: "4", DecimalSeparator: ".", DescriptionColumn: "2"}
	if _, err := NewProfile(positional); err != nil {
		t.Fatalf("positional profile: %v", err)
	}
}

func TestDateLayoutParse(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		layout DateLayout
		in     string
		want   string
	}{
		{"DD.MM.YYYY", "05.11.2026", "2026-11-05"},
		{"YYYY/MM/DD", "2026/11/05", "2026-11-05"},
		{"MM-DD-YY", "11-05-26", "2026-11-05"},
		{LayoutDayMonthYear, "05/11/2026", "2026-11-05"},
	} {
		got, err := c.layout.Parse(c.in)
		if err != nil || got.Format("2006-01-02") != c.want {
			t.Errorf("%s.Parse(%q) = %v, %v; want %s", c.layout, c.in, got, err, c.want)
		}
	}
}
