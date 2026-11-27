package main

import "strings"

// trayText holds the texts of the tray menu, the tooltip and the start failure box (PW3.3 to PW3.5).
type trayText struct {
	Open             string
	StartWithWindows string
	Quit             string
	Tooltip          string
	FailedTitle      string
	FailedBody       string
}

// trayLanguage returns "pt-BR" when the first preferred language is Portuguese, else "en" (PW3.7).
func trayLanguage(preferred []string) string {
	if len(preferred) > 0 && strings.HasPrefix(strings.ToLower(preferred[0]), "pt") {
		return "pt-BR"
	}

	return "en"
}

func trayTexts(lang string) trayText {
	if lang == "pt-BR" {
		return trayText{
			Open:             "Abrir equori",
			StartWithWindows: "Iniciar com o Windows",
			Quit:             "Sair",
			Tooltip:          "equori · %s",
			FailedTitle:      "O equori não iniciou",
			FailedBody:       "%s\n\nLog: %s",
		}
	}

	return trayText{
		Open:             "Open equori",
		StartWithWindows: "Start with Windows",
		Quit:             "Quit",
		Tooltip:          "equori · %s",
		FailedTitle:      "equori did not start",
		FailedBody:       "%s\n\nLog: %s",
	}
}
