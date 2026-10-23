package server_test

import (
	"encoding/json"
	"regexp"
	"strings"
	"testing"

	"github.com/google/jsonschema-go/jsonschema"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Budgets of spec 7.4: a declaration sent to the model and the whole catalog, in bytes.
const (
	maxDeclaration = 3000
	maxCatalog     = 50000
)

func chatTools(t *testing.T) []tool.Tool {
	t.Helper()
	return apitest.New(t).App.Tools.Tools()
}

// properties calls f with the path and schema of every property of s, at any depth.
func properties(path string, s *jsonschema.Schema, f func(path string, p *jsonschema.Schema)) {
	if s == nil {
		return
	}
	for name, p := range s.Properties {
		f(path+"."+name, p)
		properties(path+"."+name, p, f)
	}
	properties(path+"[]", s.Items, f)
}

func TestToolCatalogQuality(t *testing.T) {
	t.Parallel()
	total := 0
	for _, tl := range chatTools(t) {
		s := tl.Spec()
		if !strings.HasPrefix(s.Description, "Use ") && !strings.Contains(s.Description, ". Use ") {
			t.Errorf("tool %s: the description has no sentence starting \"Use \"", s.Name)
		}
		if !strings.HasPrefix(s.Description, "Do not use ") && !strings.Contains(s.Description, ". Do not use ") {
			t.Errorf("tool %s: the description has no sentence starting \"Do not use \"", s.Name)
		}
		properties(s.Name, tl.InputSchema(), func(path string, p *jsonschema.Schema) {
			if strings.TrimSpace(p.Description) == "" {
				t.Errorf("tool input %s has no description", path)
			}
		})
		decl, err := json.Marshal(struct {
			Name        string             `json:"name"`
			Description string             `json:"description"`
			Parameters  *jsonschema.Schema `json:"parameters"`
		}{s.Name, s.Description, tl.InputSchema()})
		if err != nil {
			t.Fatal(err)
		}
		if len(decl) > maxDeclaration {
			t.Errorf("tool %s: declaration of %d bytes exceeds %d", s.Name, len(decl), maxDeclaration)
		}
		total += len(decl)
	}
	if total > maxCatalog {
		t.Errorf("catalog of %d bytes exceeds %d", total, maxCatalog)
	}
}

// TestToolInputsHaveNoUser keeps the user out of the model's reach (ADR 003): the user comes
// from the context, never from an argument.
func TestToolInputsHaveNoUser(t *testing.T) {
	t.Parallel()
	user := regexp.MustCompile(`(?i)user`)
	for _, tl := range chatTools(t) {
		properties(tl.Spec().Name, tl.InputSchema(), func(path string, _ *jsonschema.Schema) {
			if name := path[strings.LastIndexAny(path, ".]")+1:]; user.MatchString(name) {
				t.Errorf("tool input %s names a user", path)
			}
		})
	}
}
