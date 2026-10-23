package domain

import "slices"

// API is the wire protocol of a provider.
type API string

const (
	APIGemini API = "gemini"
	APIOpenAI API = "openai"
)

// Notice tells the owner what happens to submitted data (ADR 019).
type Notice string

const (
	// NoticeTrains: the free tier uses submitted content to improve the provider's products.
	NoticeTrains Notice = "trains"
	// NoticeLocal: data stays on the configured host.
	NoticeLocal Notice = "local"
	// NoticeProviderTerms: the owner reads the provider's terms.
	NoticeProviderTerms Notice = "provider_terms"
)

const (
	CapTools            = "tools"
	CapStructuredOutput = "structured_output"
	CapImageInput       = "image_input"
)

const PresetCustom = "custom"

type PresetModel struct {
	ID           string
	Capabilities []string
}

// Preset is a known service: its API, address, key rule, notice and suggested models.
type Preset struct {
	ID          string
	API         API
	BaseURL     string
	KeyRequired bool
	Notice      Notice
	Models      []PresetModel
}

var toolsAndStructured = []string{CapTools, CapStructuredOutput}

// Presets returns the known services in display order. Suggested models are confirmed by the
// live tests of their adapter.
func Presets() []Preset {
	return []Preset{
		{ID: "gemini", API: APIGemini, BaseURL: "https://generativelanguage.googleapis.com", KeyRequired: true, Notice: NoticeTrains,
			Models: []PresetModel{{"gemini-3.5-flash", toolsAndStructured}, {"gemini-3.5-flash-lite", toolsAndStructured}}},
		{ID: "groq", API: APIOpenAI, BaseURL: "https://api.groq.com/openai/v1", KeyRequired: true, Notice: NoticeProviderTerms,
			Models: []PresetModel{{"openai/gpt-oss-120b", toolsAndStructured}}},
		{ID: "openrouter", API: APIOpenAI, BaseURL: "https://openrouter.ai/api/v1", KeyRequired: true, Notice: NoticeProviderTerms},
		{ID: "mistral", API: APIOpenAI, BaseURL: "https://api.mistral.ai/v1", KeyRequired: true, Notice: NoticeProviderTerms,
			Models: []PresetModel{{"mistral-small-latest", toolsAndStructured}}},
		{ID: "ollama", API: APIOpenAI, BaseURL: "http://127.0.0.1:11434/v1", Notice: NoticeLocal,
			Models: []PresetModel{{"qwen3:32b", toolsAndStructured}}},
		{ID: "lmstudio", API: APIOpenAI, BaseURL: "http://127.0.0.1:1234/v1", Notice: NoticeLocal},
		{ID: PresetCustom, API: APIOpenAI, Notice: NoticeProviderTerms},
	}
}

func FindPreset(id string) (Preset, bool) {
	i := slices.IndexFunc(Presets(), func(p Preset) bool { return p.ID == id })
	if i < 0 {
		return Preset{}, false
	}
	return Presets()[i], true
}

// ModelCapabilities returns the preset's capabilities for a model it names, else asserted.
func ModelCapabilities(preset, model string, asserted []string) []string {
	if p, ok := FindPreset(preset); ok {
		if i := slices.IndexFunc(p.Models, func(m PresetModel) bool { return m.ID == model }); i >= 0 {
			return p.Models[i].Capabilities
		}
	}
	return asserted
}

// Missing returns the needs absent from have, in the order of needs.
func Missing(needs, have []string) []string {
	var out []string
	for _, n := range needs {
		if !slices.Contains(have, n) {
			out = append(out, n)
		}
	}
	return out
}

func ValidateCapabilities(caps []string) error {
	for _, c := range caps {
		if c != CapTools && c != CapStructuredOutput && c != CapImageInput {
			return invalid("capabilities", "unknown capability "+c)
		}
	}
	return nil
}
