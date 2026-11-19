package assistant

import (
	"github.com/andrelopes-code/equori/internal/assistant/app"
)

// AccountNotice is an account whose figures an answer qualifies (P12 A152).
type AccountNotice = app.AccountNotice

// ViewKey and ViewBuilder register the views of a module's reads (answer views design, V3).
type (
	ViewKey     = app.ViewKey
	ViewBuilder = app.ViewBuilder
)

// Signal is evidence the model receives with a proposal.
type Signal = app.Signal

// ErrSecretKeyMissing: the instance has no EQUORI_SECRET_KEY, so no provider key opens or seals (ADR 008, K2).
var ErrSecretKeyMissing = app.ErrSecretKeyMissing

// Prompt is a user message an MCP client offers its user; the module does not import the SDK.
type Prompt struct {
	Name, Description string
	Arguments         []PromptArgument
	Render            func(args map[string]string) (string, error)
}

type PromptArgument struct {
	Name, Description string
	Required          bool
}
