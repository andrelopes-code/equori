package server_test

import (
	"bytes"
	"encoding/json"
	"flag"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/andrelopes-code/equori/api"
	"github.com/andrelopes-code/equori/internal/apitest"
)

var update = flag.Bool("update", false, "rewrite testdata/tools.json from the registry")

// exclusions are the reasons an operation has no tool (ADR 012 T14, amended by spec 7.2).
var exclusions = map[string]bool{
	"-session": true, // authentication
	"-binary":  true, // file content
	"-capture": true, // the capture screen's typing loop; a language model reads text without it (capture A116)
	"-llm":     true, // language model credentials, endpoints and the chat itself are never handed to a language model (ADR 019)
	"-secret":  true, // credentials and the aggregator's connect flow
	"-file":    true, // file content or the reading of files
	"-visual":  true, // colour, icon and logo identifiers chosen by looking at them
	"-setup":   true, // the base currency changes only before the first transaction, during provisioning
}

// withoutOperation are the tools that map to no operation, with the reason.
var withoutOperation = map[string]string{
	"get_help": "answers from the guide and the navigation map, not from an operation",
}

func operationIDs(t *testing.T) []string {
	t.Helper()
	doc, err := openapi3.NewLoader().LoadFromData(api.Contract)
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, item := range doc.Paths.Map() {
		for _, op := range item.Operations() {
			ids = append(ids, op.OperationID)
		}
	}
	slices.Sort(ids)
	return ids
}

func TestToolExposure(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	ops := operationIDs(t)
	for _, op := range ops {
		if _, ok := exposure[op]; !ok {
			t.Errorf("operation %s has no tool exposure entry in tool_exposure_test.go", op)
		}
	}
	referenced := map[string]bool{}
	for op, v := range exposure {
		if !slices.Contains(ops, op) {
			t.Errorf("tool exposure entry %s names no operation of api/openapi.yaml", op)
		}
		if strings.HasPrefix(v, "-") {
			if !exclusions[v] {
				t.Errorf("operation %s has exclusion %q, not one of %v", op, v, slices.Sorted(maps.Keys(exclusions)))
			}
			continue
		}
		for _, name := range strings.Split(v, ",") {
			if _, ok := h.App.Tools.Tool(name); !ok {
				t.Errorf("operation %s maps to tool %s, which the registry lacks", op, name)
			}
			referenced[name] = true
		}
	}
	for _, tl := range h.App.Tools.Tools() {
		if name := tl.Spec().Name; !referenced[name] && withoutOperation[name] == "" {
			t.Errorf("tool %s maps to no operation in tool_exposure_test.go", name)
		}
	}
}

// TestToolCatalog shows every change of a tool's contract in the diff of testdata/tools.json.
func TestToolCatalog(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	type entry struct {
		Name         string `json:"name"`
		Description  string `json:"description"`
		Effect       string `json:"effect"`
		Idempotent   bool   `json:"idempotent"`
		InputSchema  any    `json:"input_schema"`
		OutputSchema any    `json:"output_schema"`
	}
	var catalog []entry
	for _, tl := range h.App.Tools.Tools() {
		s := tl.Spec()
		catalog = append(catalog, entry{
			Name: s.Name, Description: s.Description, Effect: s.Effect.String(), Idempotent: s.Idempotent,
			InputSchema: tl.InputSchema(), OutputSchema: tl.OutputSchema(),
		})
	}
	got, err := json.MarshalIndent(catalog, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	got = append(got, '\n')
	path := filepath.Join("testdata", "tools.json")
	if *update {
		if err := os.WriteFile(path, got, 0o600); err != nil {
			t.Fatal(err)
		}
		return
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Errorf("the tool catalog differs from %s; review the change, then run go test ./internal/server -run TestToolCatalog -update\n%s", path, got)
	}
}
