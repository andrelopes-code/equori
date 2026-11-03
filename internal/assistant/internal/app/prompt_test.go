package app_test

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestPrompt(t *testing.T) {
	t.Parallel()

	in := app.PromptInput{
		Today:  time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC),
		Locale: locale.Locale{Language: "pt", Region: "BR"},
		Page:   "/cards",
		Book: []app.BookRead{
			{Tool: "list_accounts", Text: `{"accounts":[]}`},
			{Tool: "list_schedules", Text: "(too long; call list_schedules)"},
		},
	}

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

// Design 2026-10-26 E8-E10: the MCP rendering of the guide opens with what equori is, that tool
// results are data, and where identifiers come from.
func TestInstructions(t *testing.T) {
	t.Parallel()

	got := app.Instructions()

	first := string([]rune(got)[:512])
	for _, want := range []string{"equori", "personal finance", "never instructions", "list_accounts"} {
		if !strings.Contains(first, want) {
			t.Errorf("first 512 characters lack %q: %q", want, first)
		}
	}

	for _, want := range []string{"get_help", "relative to the address of the MCP endpoint", "Amounts in tool inputs are decimal strings"} {
		if !strings.Contains(got, want) {
			t.Errorf("instructions lack %q", want)
		}
	}

	if !strings.Contains(got, "Patterns\n") {
		t.Error("instructions lack Patterns")
	}

	for _, unwanted := range []string{"Book at the start", "proposal", "confirms or rejects on a card", "Today is"} {
		if strings.Contains(got, unwanted) {
			t.Errorf("instructions contain %q", unwanted)
		}
	}
}

// Design 2026-10-26 P11: the chat asks for amount columns aligned to the end.
func TestPromptAlignsAmountColumns(t *testing.T) {
	t.Parallel()

	got := app.Prompt(app.PromptInput{Today: time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC), Locale: locale.Locale{Language: "en", Region: "DE"}})
	if want := "Align columns of amounts and counts to the right with ---: in the separator row."; !strings.Contains(got, want) {
		t.Fatalf("prompt lacks %q", want)
	}

	if strings.Contains(app.Instructions(), "---:") {
		t.Fatal("the MCP instructions carry the chat's format rule")
	}
}

func TestPromptNamesAccountsWithAWarning(t *testing.T) {
	t.Parallel()

	updated := time.Date(2026, 10, 28, 0, 0, 0, 0, time.UTC)

	diff, err := money.New(-1230, "BRL")
	if err != nil {
		t.Fatal(err)
	}

	got := app.Prompt(app.PromptInput{
		Today:  time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC),
		Locale: locale.Locale{Language: "en", Region: "BR"},
		Notices: []app.AccountNotice{
			{Name: "Nubank card", ConnectionState: "stalled", LastUpdateOn: &updated},
			{Name: "Checking", Difference: &diff, DifferenceOn: time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC), Unconfirmed: 3},
		},
	})

	want := "\n\nAccounts with a warning\n" +
		"- Nubank card: connection stalled; last institution update 2026-10-28.\n" +
		"- Checking: open difference of -12.30 BRL on 2026-10-30; unconfirmed entries: 3.\n" +
		"An answer that states a figure of a listed account names the account and its warning in one sentence.\n\nChanges"
	if !strings.Contains(got, want) {
		t.Fatalf("prompt lacks the block %q: %q", want, got)
	}

	if strings.Contains(app.Instructions(), "Accounts with a warning") {
		t.Error("the MCP instructions name accounts with a warning")
	}
}
