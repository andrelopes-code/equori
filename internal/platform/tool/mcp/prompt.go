package mcp

import (
	"context"

	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

// Prompt is a user message template a client offers its user (design 2026-10-26 X18).
type Prompt struct {
	Name, Description string
	Arguments         []PromptArgument
	Render            func(args map[string]string) (string, error)
}

type PromptArgument struct {
	Name, Description string
	Required          bool
}

func addPrompt(s *sdk.Server, p Prompt) {
	args := make([]*sdk.PromptArgument, 0, len(p.Arguments))
	for _, a := range p.Arguments {
		args = append(args, &sdk.PromptArgument{Name: a.Name, Description: a.Description, Required: a.Required})
	}
	s.AddPrompt(&sdk.Prompt{Name: p.Name, Description: p.Description, Arguments: args},
		func(_ context.Context, req *sdk.GetPromptRequest) (*sdk.GetPromptResult, error) {
			text, err := p.Render(req.Params.Arguments)
			if err != nil {
				return nil, err
			}
			return &sdk.GetPromptResult{Messages: []*sdk.PromptMessage{{Role: "user", Content: &sdk.TextContent{Text: text}}}}, nil
		})
}
