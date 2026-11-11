package assistant

import "github.com/andrelopes-code/equori/internal/assistant/app"

// Instructions returns the guide an MCP client receives as its instructions (design 2026-10-26 E10).
func Instructions() string { return app.Instructions() }

// Prompts returns the MCP prompts (design 2026-10-26 X18).
func Prompts() []Prompt {
	var out []Prompt
	for _, p := range app.MCPPrompts() {
		args := make([]PromptArgument, 0, len(p.Arguments))
		for _, a := range p.Arguments {
			args = append(args, PromptArgument(a))
		}

		out = append(out, Prompt{Name: p.Name, Description: p.Description, Arguments: args, Render: p.Render})
	}

	return out
}
