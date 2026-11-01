package config

import "testing"

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
