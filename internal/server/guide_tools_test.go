package server_test

import (
	"encoding/json"
	"os"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant/guide"
)

type catalogTool struct {
	Name   string `json:"name"`
	Effect string `json:"effect"`
	// Internal: no model calls the tool, so no article names it (undo restore design, U7).
	Internal    bool `json:"internal"`
	InputSchema struct {
		Required   []string `json:"required"`
		Properties map[string]struct {
			Enum []any `json:"enum"`
		} `json:"properties"`
	} `json:"input_schema"`
}

// TestGuideCoversTools keeps the guide complete for the tools (assistant parity design, G3):
// every tool is named in an article, and the articles that name a tool that writes also name
// each of its required inputs and each value of its closed sets. A model that reads the article
// then knows every fact the call needs.
func TestGuideCoversTools(t *testing.T) {
	t.Parallel()

	data, err := os.ReadFile("testdata/tools.json")
	if err != nil {
		t.Fatal(err)
	}

	var tools []catalogTool
	if err := json.Unmarshal(data, &tools); err != nil {
		t.Fatal(err)
	}

	var articles []string
	for _, topic := range guide.Topics() {
		a, _ := guide.Article(topic)
		articles = append(articles, a)
	}

	for _, tl := range tools {
		if tl.Internal {
			continue
		}

		var naming []string
		for _, a := range articles {
			if hasWord(a, tl.Name) {
				naming = append(naming, a)
			}
		}

		if len(naming) == 0 {
			t.Errorf("tool %s is named in no guide article", tl.Name)
			continue
		}

		if tl.Effect != "write" && tl.Effect != "destructive" {
			continue
		}

		text := strings.Join(naming, "\n")
		for _, word := range writeToolWords(tl) {
			if !hasWord(text, word) {
				t.Errorf("tool %s: no article that names it explains %q", tl.Name, word)
			}
		}
	}
}

// TestGuideCoversLimits keeps the assistant honest about what it does not do (assistant parity
// design, G5): the article privacy_and_the_assistant names each exclusion in use, so the model
// states the limit and the screen that serves it instead of guessing a tool.
func TestGuideCoversLimits(t *testing.T) {
	t.Parallel()

	article, _ := guide.Article("privacy_and_the_assistant")

	used := map[string]bool{}
	for _, names := range exposure {
		if strings.HasPrefix(names, "-") {
			used[strings.TrimPrefix(names, "-")] = true
		}
	}

	for class := range used {
		if !strings.Contains(article, "\n- "+class+": ") {
			t.Errorf("privacy_and_the_assistant has no line for the exclusion %q", class)
		}
	}
}

// writeToolWords returns the required inputs of a tool and the values of its closed sets.
func writeToolWords(tl catalogTool) []string {
	words := slices.Clone(tl.InputSchema.Required)

	for _, p := range tl.InputSchema.Properties {
		for _, v := range p.Enum {
			if s, ok := v.(string); ok {
				words = append(words, s)
			}
		}
	}

	slices.Sort(words)

	return slices.Compact(words)
}

// hasWord reports whether text holds word outside a longer identifier.
func hasWord(text, word string) bool {
	return regexp.MustCompile(`(^|[^a-z_])` + regexp.QuoteMeta(word) + `($|[^a-z_])`).
		MatchString(text)
}

// TestGuideCoversSubtypes keeps the article of a region complete for its products (assistant
// parity design, G4): each subtype the jurisdiction of Brazil returns for an instrument type is
// named in the regional article of its product family.
func TestGuideCoversSubtypes(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.As(apitest.Brazil()))

	for instrumentType, topic := range map[string]string{
		"fixed_income": "fixed_income_br",
		"fund":         "funds_br",
	} {
		article, _ := guide.Article(topic)

		r := h.Tool("get_portfolio", map[string]any{
			"view": "subtypes", "instrument_type": instrumentType,
		})
		if r.IsError {
			t.Fatalf("subtypes of %s = %s", instrumentType, r.Content)
		}

		var out struct {
			Subtypes []string `json:"subtypes"`
		}
		if err := json.Unmarshal(r.Content, &out); err != nil {
			t.Fatal(err)
		}

		if len(out.Subtypes) == 0 {
			t.Fatalf("no subtype of %s in a book of Brazil", instrumentType)
		}

		for _, subtype := range out.Subtypes {
			if !hasWord(article, subtype) {
				t.Errorf("%s does not name the %s subtype %q", topic, instrumentType, subtype)
			}
		}
	}
}
