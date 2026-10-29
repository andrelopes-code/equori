package toolapi_test

import (
	"encoding/json"
	"os"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type helpOut struct {
	Topic   string `json:"topic"`
	Article string `json:"article"`
	Screens []struct {
		Path   string `json:"path"`
		Screen string `json:"screen"`
	} `json:"screens"`
}

func TestGetHelp(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	call := func(topic string) (helpOut, string) {
		r := h.Tool("get_help", map[string]string{"topic": topic})
		if r.IsError {
			return helpOut{}, string(r.Content)
		}
		var out helpOut
		if err := json.Unmarshal(r.Content, &out); err != nil {
			t.Fatal(err)
		}
		return out, ""
	}

	appendix, err := os.ReadFile("../../../../../docs/plans/2026-10-23-assistant-chat/appendix-b-guide.md")
	if err != nil {
		t.Fatal(err)
	}
	m := regexp.MustCompile("(?s)## credit_cards_and_statements\n\n```markdown\n([^\n]*)").FindSubmatch(appendix)
	if m == nil {
		t.Fatal("article not found in appendix B")
	}
	out, _ := call("credit_cards_and_statements")
	if out.Topic != "credit_cards_and_statements" || !strings.HasPrefix(out.Article, string(m[1])) {
		t.Fatalf("topic = %q, article = %.60q", out.Topic, out.Article)
	}
	var paths []string
	for _, s := range out.Screens {
		paths = append(paths, s.Path)
	}
	for _, want := range []string{"/cards", "/cards/$accountId/statements/$statementId"} {
		if !slices.Contains(paths, want) {
			t.Errorf("screens %v lack %s", paths, want)
		}
	}

	r := h.Tool("get_help", map[string]string{"topic": "budgets"})
	if r.IsError || !strings.Contains(string(r.Content), `"path":"/planning/budgets/$id"`) {
		t.Fatalf("budgets = %s", r.Content)
	}
	h.ExpectToolError(h.Tool("get_help", map[string]string{"topic": "nope"}), "invalid_arguments", "")
}
