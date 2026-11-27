package main

import "testing"

// PW3.7: Portuguese as the first language selects pt-BR; anything else selects en.
func TestTrayLanguage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		preferred []string
		want      string
	}{
		{[]string{"pt-BR"}, "pt-BR"},
		{[]string{"pt-PT"}, "pt-BR"},
		{[]string{"PT-br"}, "pt-BR"},
		{[]string{"en-US", "pt-BR"}, "en"},
		{[]string{}, "en"},
		{[]string{"es-ES"}, "en"},
	}
	for _, tt := range tests {
		if got := trayLanguage(tt.preferred); got != tt.want {
			t.Errorf("trayLanguage(%v) = %q, want %q", tt.preferred, got, tt.want)
		}
	}
}

// R5: the texts of PW3.3 to PW3.5 in both languages.
func TestTrayTexts(t *testing.T) {
	t.Parallel()

	tests := []struct {
		lang string
		want trayText
	}{
		{"en", trayText{
			Open:             "Open equori",
			StartWithWindows: "Start with Windows",
			Quit:             "Quit",
			Tooltip:          "equori · %s",
			FailedTitle:      "equori did not start",
			FailedBody:       "%s\n\nLog: %s",
		}},
		{"pt-BR", trayText{
			Open:             "Abrir equori",
			StartWithWindows: "Iniciar com o Windows",
			Quit:             "Sair",
			Tooltip:          "equori · %s",
			FailedTitle:      "O equori não iniciou",
			FailedBody:       "%s\n\nLog: %s",
		}},
	}
	for _, tt := range tests {
		if got := trayTexts(tt.lang); got != tt.want {
			t.Errorf("trayTexts(%q) = %+v, want %+v", tt.lang, got, tt.want)
		}
	}
}
