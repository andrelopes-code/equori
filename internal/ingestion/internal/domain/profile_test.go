package domain

import (
	"errors"
	"testing"
)

func TestNewProfile(t *testing.T) {
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
		{"delimiter", func(p *Profile) { p.Delimiter = ":" }, "delimiter"},
		{"layout", func(p *Profile) { p.DateLayout = "DD-MM-YY" }, "date_layout"},
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
