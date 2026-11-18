package toolapi

import (
	"encoding/json"
	"flag"
	"os"
	"reflect"
	"testing"
)

var update = flag.Bool("update", false, "write web/src/theme/appearance-values.json")

const appearanceValuesFile = "../../../web/src/theme/appearance-values.json"

// TestAppearanceValues keeps the value sets of set_appearance equal to the file a web test checks
// against the checks of web/src/theme (assistant parity design, AP2).
func TestAppearanceValues(t *testing.T) {
	want, err := json.MarshalIndent(appearanceValues, "", "  ")
	if err != nil {
		t.Fatal(err)
	}

	want = append(want, '\n')

	if *update {
		if err := os.WriteFile(appearanceValuesFile, want, 0o600); err != nil {
			t.Fatal(err)
		}
	}

	b, err := os.ReadFile(appearanceValuesFile)
	if err != nil {
		t.Fatal(err)
	}

	// Compared as values: the pre-commit hook rewrites the file in the layout of Prettier.
	var got map[string][]string
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatal(err)
	}

	if !reflect.DeepEqual(got, appearanceValues) {
		t.Errorf(
			"%s differs from appearanceValues; run go test ./internal/identity/toolapi -update",
			appearanceValuesFile,
		)
	}
}
