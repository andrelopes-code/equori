// Package toolapi declares the assistant module's tools for language models (ADR 012).
package toolapi

import (
	"github.com/andrelopes-code/equori/internal/assistant/internal/guide"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func Tools(screens []guide.Screen) []tool.Tool {
	return []tool.Tool{getHelp(screens)}
}
