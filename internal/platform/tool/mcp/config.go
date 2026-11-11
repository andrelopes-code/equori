package mcp

import (
	"log/slog"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type Config struct {
	Registry *tool.Registry
	// Names are the tools of the chat set; a read grant reaches only the ReadOnly ones.
	Names        []string
	Instructions string
	Prompts      []Prompt
	Version      string
	Verify       Verify
	Log          *slog.Logger
}
