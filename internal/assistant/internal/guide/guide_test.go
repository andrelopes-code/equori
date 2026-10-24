package guide_test

import (
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/assistant/internal/guide"
	"github.com/andrelopes-code/equori/web"
)

func TestArticlesExist(t *testing.T) {
	t.Parallel()
	if n := len(guide.Topics()); n != 19 {
		t.Fatalf("topics = %d, want 19", n)
	}
	for _, topic := range guide.Topics() {
		a, ok := guide.Article(topic)
		if !ok || len(a) < 200 || len(a) > 3000 {
			t.Errorf("article %s: found = %v, %d bytes, want 200 to 3000", topic, ok, len(a))
		}
	}
	if _, ok := guide.Article("nope"); ok {
		t.Error("unknown topic has an article")
	}
}

var bold = regexp.MustCompile(`\*\*([^*]+)\*\*`)

func TestGuideTermsExistInGlossary(t *testing.T) {
	t.Parallel()
	b, err := os.ReadFile("../../../../docs/domain/02-ubiquitous-language.md")
	if err != nil {
		t.Fatal(err)
	}
	glossary := map[string]bool{}
	for line := range strings.SplitSeq(string(b), "\n") {
		if cells := strings.Split(line, "|"); len(cells) > 2 && strings.HasPrefix(line, "|") {
			glossary[strings.ToLower(strings.TrimSpace(cells[1]))] = true
		}
	}
	for _, topic := range guide.Topics() {
		a, _ := guide.Article(topic)
		for _, m := range bold.FindAllStringSubmatch(a, -1) {
			if !glossary[strings.ToLower(m[1])] {
				t.Errorf("article %s: term %q is not in the glossary", topic, m[1])
			}
		}
	}
}

func TestParseMap(t *testing.T) {
	t.Parallel()
	for name, in := range map[string]string{
		"unknown topic": `[{"path":"/a","topics":["nope"],"screen":"A","tasks":[]}]`,
		"bad path":      `[{"path":"a b","topics":["goals"],"screen":"A","tasks":[]}]`,
		"not json":      `{`,
	} {
		if _, err := guide.ParseMap([]byte(in)); err == nil {
			t.Errorf("%s: no error", name)
		}
	}
	got, err := guide.ParseMap([]byte(`[{"path":"/cards/$id","topics":["goals"],"screen":"A","tasks":["x"]}]`))
	if err != nil || len(got) != 1 || got[0].Path != "/cards/$id" {
		t.Fatalf("got = %+v, %v", got, err)
	}
}

// A topic without a screen is a gap in the navigation map.
func TestGuideTopicsHaveScreens(t *testing.T) {
	t.Parallel()
	screens, err := guide.ParseMap(web.NavigationMap())
	if err != nil {
		t.Fatal(err)
	}
	has := map[string]bool{}
	for _, s := range screens {
		for _, topic := range s.Topics {
			has[topic] = true
		}
	}
	for _, topic := range guide.Topics() {
		if !has[topic] {
			t.Errorf("topic %s has no screen", topic)
		}
	}
}
