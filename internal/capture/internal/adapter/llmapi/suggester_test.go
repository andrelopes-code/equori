package llmapi

import (
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/locale"
)

func TestSystemPrompt(t *testing.T) {
	tests := []struct {
		name   string
		locale locale.Locale
		want   string
	}{
		{"pt-BR", locale.Locale{Language: "pt", Region: "BR"}, "mostly in Portuguese (Brazil)"},
		{"en-GB", locale.Locale{Language: "en", Region: "GB"}, "mostly in English (United Kingdom)"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := systemPrompt(tt.locale)
			if !strings.Contains(got, tt.want) {
				t.Errorf("prompt lacks %q:\n%s", tt.want, got)
			}
			if strings.Contains(got, "Brazilian owner") {
				t.Errorf("prompt names a nationality:\n%s", got)
			}
		})
	}
}
