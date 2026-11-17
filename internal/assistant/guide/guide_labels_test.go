package guide_test

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/assistant/guide"
)

// quoted matches a text an article puts in double quotes: the label of a button, a field or a
// choice. A quote with a digit is an example of what the user types, not a label.
var quoted = regexp.MustCompile(`"([^"\n0-9]{2,60})"`)

// The assistant states a button or a field only as an article states it (A244), so a label an
// article quotes must be a text the interface draws: a renamed button fails here until the
// article follows it.
func TestGuideQuotedLabelsExistInCatalog(t *testing.T) {
	t.Parallel()

	files, err := filepath.Glob("../../../web/src/i18n/catalog*.en.ts")
	if err != nil || len(files) == 0 {
		t.Fatalf("catalog files = %v, %v", files, err)
	}

	var catalog strings.Builder

	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}

		catalog.WriteString(strings.ToLower(string(b)))
	}

	labels := 0

	for _, topic := range guide.Topics() {
		a, _ := guide.Article(topic)
		for _, m := range quoted.FindAllStringSubmatch(a, -1) {
			labels++

			if !strings.Contains(catalog.String(), strings.ToLower(m[1])) {
				t.Errorf("article %s: label %q is not a text of the interface", topic, m[1])
			}
		}
	}

	if labels == 0 {
		t.Error("no article quotes a label: the pattern matches nothing")
	}
}
