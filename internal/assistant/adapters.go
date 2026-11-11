package assistant

// instancePreset maps an environment provider to its preset; only the Gemini adapter is
// configured through the environment.
func instancePreset(name string) string {
	if name == "aistudio" {
		return "gemini"
	}

	return name
}
