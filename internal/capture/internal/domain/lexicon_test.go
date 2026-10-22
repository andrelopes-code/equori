package domain

import (
	"reflect"
	"testing"
)

func TestMergePrimaryWins(t *testing.T) {
	t.Parallel()
	got := Merge(
		Lexicon{DaysBack: map[string]int{"hoje": 0}},
		Lexicon{DaysBack: map[string]int{"hoje": 5, "today": 0}},
	)
	if want := map[string]int{"hoje": 0, "today": 0}; !reflect.DeepEqual(got.DaysBack, want) {
		t.Fatalf("DaysBack = %v, want %v", got.DaysBack, want)
	}
}

func TestMergeLists(t *testing.T) {
	t.Parallel()
	got := Merge(
		Lexicon{Language: "pt", Source: []string{"de", "do"}, LumpSum: [][]string{{"a", "vista"}}},
		Lexicon{Language: "en", Source: []string{"from", "de"}, LumpSum: [][]string{{"a", "vista"}, {"in", "full"}}},
	)
	if got.Language != "pt" {
		t.Errorf("Language = %q, want pt", got.Language)
	}
	if want := []string{"de", "do", "from"}; !reflect.DeepEqual(got.Source, want) {
		t.Errorf("Source = %v, want %v", got.Source, want)
	}
	if want := [][]string{{"a", "vista"}, {"in", "full"}}; !reflect.DeepEqual(got.LumpSum, want) {
		t.Errorf("LumpSum = %v, want %v", got.LumpSum, want)
	}
}

func TestLexiconsAreFresh(t *testing.T) {
	t.Parallel()
	Portuguese().DaysBack["hoje"] = 9
	if got := Portuguese().DaysBack["hoje"]; got != 0 {
		t.Fatalf("a mutation leaked into the next Portuguese(): hoje = %d", got)
	}
}
