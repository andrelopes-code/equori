package charset

import (
	"testing"

	"golang.org/x/text/encoding/charmap"
)

func TestDecode(t *testing.T) {
	t.Parallel()
	cyrillic, _ := charmap.Windows1251.NewEncoder().String("Магазин")
	latin, _ := charmap.Windows1252.NewEncoder().String("Café")
	tests := []struct {
		name string
		in   []byte
		enc  string
		want string
	}{
		{"utf-8 unchanged", []byte("Pão de Açúcar"), "auto", "Pão de Açúcar"},
		{"windows-1252 fallback", []byte{'P', 0xE3, 'o', ' ', 0x80, '1', 0x96, '2'}, "auto", "Pão €1–2"},
		{"ascii", []byte("Mercado"), "auto", "Mercado"},
		{"declared windows-1251", []byte(cyrillic), "windows-1251", "Магазин"},
		{"auto windows-1252", []byte(latin), "auto", "Café"},
		{"bom under windows-1252 decodes as utf-8", []byte("\xef\xbb\xbfCafé"), "windows-1252", "Café"},
		{"bom under auto", []byte("\xef\xbb\xbfCafé"), "auto", "Café"},
		{"utf-8", []byte("Café"), "utf-8", "Café"},
		{"iso-8859-1", []byte{'C', 'a', 'f', 0xE9}, "iso-8859-1", "Café"},
		{"shift_jis", []byte{0x83, 0x65, 0x83, 0x58, 0x83, 0x67}, "shift_jis", "テスト"},
	}
	for _, tc := range tests {
		got, err := Decode(tc.in, tc.enc)
		if err != nil || got != tc.want {
			t.Errorf("%s: Decode(%q, %s) = %q, %v; want %q", tc.name, tc.in, tc.enc, got, err, tc.want)
		}
	}
	if _, err := Decode([]byte("x"), "ebcdic"); err == nil {
		t.Error("ebcdic accepted")
	}
}

func TestNames(t *testing.T) {
	t.Parallel()
	for _, name := range Names() {
		if _, err := Decode([]byte("x"), name); err != nil {
			t.Errorf("listed name %s: %v", name, err)
		}
	}
	if len(Names()) != 11 || Names()[0] != "auto" {
		t.Errorf("Names = %v", Names())
	}
}
