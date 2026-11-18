package toolapi

import (
	"bytes"
	"encoding/json"
	"flag"
	"os"
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

	got, err := os.ReadFile(appearanceValuesFile)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(got, want) {
		t.Errorf(
			"%s differs from appearanceValues; run go test ./internal/identity/toolapi -update",
			appearanceValuesFile,
		)
	}
}
