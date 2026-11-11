package app

// Use mirrors llm.Use: app does not import llm (ADR 009 M1).
type Use struct {
	ID                 string
	Needs              []string
	SendsFinancialData bool
	Default            []DefaultTarget
}

type DefaultTarget struct {
	Preset string
	Model  string
}

// Instance is a provider configured for the whole instance through the environment. Its ID
// is its adapter name, which is also its cooldown key.
type Instance struct {
	ID     string
	Preset string
}
