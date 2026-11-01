package main

import (
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/config"
)

func TestEnvNames(t *testing.T) {
	t.Parallel()

	got := envNames(
		[]string{"EQUORI_A=1", "PATH=/bin", "EQUORI_B=x=y"},
		map[string]string{"EQUORI_A": "2", "EQUORI_C": "3"},
	)

	want := []string{"EQUORI_A", "EQUORI_B", "EQUORI_C"}
	if !slices.Equal(got, want) {
		t.Fatalf("envNames = %v, want %v", got, want)
	}
}

func TestEveryReadNameIsMapped(t *testing.T) {
	t.Parallel()

	var read []string

	record := func(name string) string {
		read = append(read, name)

		return ""
	}

	// An empty environment has no data directory, so Load returns an error; only the names read matter.
	_, _ = config.Load(record, families())

	for _, name := range read {
		if !strings.HasPrefix(name, envPrefix) {
			continue
		}

		v, ok := config.Lookup(name)
		if !ok || v.Reader != config.Binary {
			t.Errorf("%s: Lookup = %v, %v; want a %s entry", name, ok, v.Reader, config.Binary)
		}
	}

	for _, name := range []string{"EQUORI_AGGREGATOR_PLUGGY_URL", "EQUORI_FEED_BCB_PTAX_URL"} {
		if !slices.Contains(read, name) {
			t.Errorf("%s: not read", name)
		}
	}
}
