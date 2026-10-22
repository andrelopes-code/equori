package domain

import "testing"

func TestReadAmount(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		text     string
		minor    int64
		explicit bool
		sign     int
		words    int
		ok       bool
	}{
		{"45,9", 4590, false, 0, 1, true},
		{"45,90", 4590, false, 0, 1, true},
		{"230", 23000, false, 0, 1, true},
		{"1.234,56", 123456, false, 0, 1, true},
		{"1.234", 123400, false, 0, 1, true},
		{"1.234.567", 123456700, false, 0, 1, true},
		{"12.5", 1250, false, 0, 1, true},
		{"12.50", 1250, false, 0, 1, true},
		{"R$45", 4500, true, 0, 1, true},
		{"r$ 45,90", 4590, true, 0, 2, true},
		{"R$-30", 3000, true, -1, 1, true},
		{"+500", 50000, true, 1, 1, true},
		{"-30", 3000, true, -1, 1, true},
		{"1,5k", 150000, true, 0, 1, true},
		{"1.5k", 150000, true, 0, 1, true},
		{"2k", 200000, true, 0, 1, true},
		{"2 mil", 200000, true, 0, 2, true},
		{"2 mil reais", 200000, true, 0, 3, true},
		{"50 reais", 5000, true, 0, 2, true},
		{"24h", 0, false, 0, 0, false},
		{"99pop", 0, false, 0, 0, false},
		{"3x", 0, false, 0, 0, false},
		{"1.23.4", 0, false, 0, 0, false},
		{"12.345,6.7", 0, false, 0, 0, false},
		{"R$", 0, false, 0, 0, false},
		{"R$ uber", 0, false, 0, 0, false},
		{"->", 0, false, 0, 0, false},
		{"1234567890123456", 0, false, 0, 0, false},
	} {
		t.Run(c.text, func(t *testing.T) {
			t.Parallel()
			ws := splitWords(c.text)
			p, ok := readAmount(ws, 0, Merge(Portuguese(), English()), Conventions{',', '.', DMY})
			if ok != c.ok {
				t.Fatalf("ok = %v, want %v", ok, c.ok)
			}
			if !ok {
				return
			}
			minor, _ := p.value.minor(2)
			if minor != c.minor || p.explicit != c.explicit || p.sign != c.sign || p.words != c.words {
				t.Fatalf("got %d explicit %v sign %d words %d, want %d %v %d %d", minor, p.explicit, p.sign, p.words, c.minor, c.explicit, c.sign, c.words)
			}
		})
	}
}

func TestDecimalMinor(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		d     decimal
		scale int
		want  int64
		ok    bool
	}{
		{decimal{30999, 3}, 2, 0, false},
		{decimal{45900, 3}, 2, 4590, true},
		{decimal{0, 0}, 2, 0, false},
		{decimal{99999999999, 2}, 2, 99999999999, true},
		{decimal{100000000000, 2}, 2, 0, false},
		{decimal{1000000000, 0}, 2, 0, false},
		{decimal{15, 1}, 0, 0, false},
		{decimal{1500, 0}, 0, 1500, true},
	} {
		got, ok := c.d.minor(c.scale)
		if got != c.want || ok != c.ok {
			t.Errorf("%+v.minor(%d) = %d %v, want %d %v", c.d, c.scale, got, ok, c.want, c.ok)
		}
	}
}
