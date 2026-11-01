package config

import (
	"os"
	"strings"
	"testing"
)

func TestVariableExamples(t *testing.T) {
	t.Parallel()

	seen := make(map[string]bool)

	for _, v := range Variables() {
		if seen[v.Name] {
			t.Errorf("%s: duplicate name", v.Name)
		}

		seen[v.Name] = true

		if !v.valid(v.Example) {
			t.Errorf("%s: example %q is invalid", v.Name, v.Example)
		}

		for field, value := range map[string]string{
			"Expected": v.Expected, "Example": v.Example,
			"Description": v.Description, "DescriptionPT": v.DescriptionPT,
		} {
			if value == "" {
				t.Errorf("%s: %s is empty", v.Name, field)
			}
		}
	}
}

func TestComposeBindings(t *testing.T) {
	t.Parallel()

	raw, err := os.ReadFile("../../../compose.yaml")
	if err != nil {
		t.Fatal(err)
	}

	compose := string(raw)
	bound := 0

	for _, v := range Variables() {
		if v.Reader != Binary || v.Audience != Install {
			continue
		}

		bound++

		want := v.Name + ": ${" + v.Name + ":-}"
		if !strings.Contains(compose, want) {
			t.Errorf("compose.yaml lacks %q", want)
		}
	}

	if bound != 5 {
		t.Errorf("binary install entries = %d, want 5", bound)
	}

	port := `"${EQUORI_HOST_IP:-127.0.0.1}:${EQUORI_PORT:-8080}:8080"`
	if !strings.Contains(compose, port) {
		t.Errorf("compose.yaml lacks %s", port)
	}
}
