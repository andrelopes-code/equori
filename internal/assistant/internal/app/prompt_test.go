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

// Spec amendment of 2026-10-26: a comparison of three or more rows on two or more columns is
// one GFM table; any other table, headings, code blocks and charts stay out.
func TestPromptAllowsOneTableForAComparison(t *testing.T) {
	t.Parallel()
	got := app.Prompt(app.PromptInput{Today: time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC), Locale: locale.Locale{Language: "en", Region: "DE"}})
	for _, want := range []string{
		"When the answer compares three or more rows on two or more columns, write it as one Markdown table with a header row.",
		"No other table, and no headings, code blocks or charts.",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("prompt lacks %q", want)
		}
	}
	if strings.Contains(got, "No tables") {
		t.Error("prompt still forbids every table")
	}
}
