package domain

import (
	"errors"
	"regexp"
	"slices"
	"testing"

	"github.com/google/uuid"
)

func TestPresets(t *testing.T) {
	t.Parallel()
	pattern := regexp.MustCompile(`^[a-z0-9_]{2,40}$`)
	seen := map[string]bool{}
	for _, p := range Presets() {
		if !pattern.MatchString(p.ID) || seen[p.ID] {
			t.Fatalf("preset ID %q is invalid or repeated", p.ID)
		}
		seen[p.ID] = true
		if p.ID != PresetCustom {
			if _, err := ValidateBaseURL(p.BaseURL); err != nil {
				t.Fatalf("preset %s base URL: %v", p.ID, err)
			}
		}
	}
	gemini, ok := FindPreset("gemini")
	if !ok || gemini.API != APIGemini || gemini.Notice != NoticeTrains || !gemini.KeyRequired {
		t.Fatalf("gemini preset = %+v", gemini)
	}
	for _, model := range []string{"gemini-3.5-flash", "gemini-3.5-flash-lite"} {
		if got := ModelCapabilities("gemini", model, nil); !slices.Equal(got, []string{"tools", "structured_output"}) {
			t.Fatalf("%s capabilities = %v", model, got)
		}
	}
	if _, ok := FindPreset("nope"); ok {
		t.Fatal("FindPreset(nope) found a preset")
	}
}

func TestModelCapabilities(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name, preset, model string
		asserted, want      []string
	}{
		{name: "preset model ignores assertion", preset: "groq", model: "openai/gpt-oss-120b", asserted: []string{"image_input"}, want: []string{"tools", "structured_output"}},
		{name: "other model takes assertion", preset: "groq", model: "x", asserted: []string{"tools"}, want: []string{"tools"}},
		{name: "custom", preset: "custom", model: "x", want: nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := ModelCapabilities(tt.preset, tt.model, tt.asserted); !slices.Equal(got, tt.want) {
				t.Fatalf("capabilities = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestMissing(t *testing.T) {
	t.Parallel()
	got := Missing([]string{"tools", "structured_output"}, []string{"structured_output"})
	if !slices.Equal(got, []string{"tools"}) {
		t.Fatalf("Missing = %v, want [tools]", got)
	}
}

func TestValidateCapabilities(t *testing.T) {
	t.Parallel()
	if err := ValidateCapabilities([]string{"tools", "image_input"}); err != nil {
		t.Fatalf("valid set: %v", err)
	}
	if fe, ok := errors.AsType[*FieldError](ValidateCapabilities([]string{"speech"})); !ok || fe.Field != "capabilities" {
		t.Fatal("unknown capability accepted")
	}
}

func TestNewChainTarget(t *testing.T) {
	t.Parallel()
	if _, err := NewChainTarget(uuid.New(), "m", []string{"tools"}); err != nil {
		t.Fatalf("valid target: %v", err)
	}
	if fe, ok := errors.AsType[*FieldError](func() error { _, err := NewChainTarget(uuid.New(), " ", nil); return err }()); !ok || fe.Field != "model" {
		t.Fatal("blank model accepted")
	}
}
