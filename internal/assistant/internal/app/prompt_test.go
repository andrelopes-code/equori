package app_test

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

func TestPrompt(t *testing.T) {
	t.Parallel()
	in := app.PromptInput{Today: time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC), Locale: locale.Locale{Language: "pt", Region: "BR"}, Page: "/cards"}
	want, err := os.ReadFile("testdata/prompt_pt_BR.txt")
	if err != nil {
		t.Fatal(err)
	}
	if got := app.Prompt(in); got != string(want) {
		t.Fatalf("prompt = %q, want %q", got, want)
	}
	in.Page = ""
	if got := app.Prompt(in); strings.Contains(got, "The user is on the screen") {
		t.Fatalf("prompt with an empty page mentions the screen: %q", got)
	}
}
