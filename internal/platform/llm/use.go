package llm

// Capability is a feature a use needs from a model (ADR 019).
type Capability string

const (
	CapTools            Capability = "tools"
	CapStructuredOutput Capability = "structured_output"
	CapImageInput       Capability = "image_input"
)

func Capabilities() []Capability {
	return []Capability{CapTools, CapStructuredOutput, CapImageInput}
}

// DefaultTarget names a model of a provider preset; it applies to every provider of that preset.
type DefaultTarget struct {
	Preset string
	Model  string
}

// Use is one purpose a module calls a model for, declared in code by that module.
type Use struct {
	ID                 string
	Needs              []Capability
	SendsFinancialData bool
	Default            []DefaultTarget
}
