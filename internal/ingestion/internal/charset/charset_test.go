package charset

import "testing"

func TestText(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		in   []byte
		want string
	}{
		{"utf-8 unchanged", []byte("Pão de Açúcar"), "Pão de Açúcar"},
		{"windows-1252", []byte{'P', 0xE3, 'o', ' ', 0x80, '1', 0x96, '2'}, "Pão €1–2"},
		{"ascii", []byte("Mercado"), "Mercado"},
	}
	for _, tc := range tests {
		if got := Text(tc.in); got != tc.want {
			t.Errorf("%s: Text = %q, want %q", tc.name, got, tc.want)
		}
	}
}
