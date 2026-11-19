// Package toolapi declares the assistant module's tools for language models (ADR 012).
package toolapi

import (
	"github.com/andrelopes-code/equori/internal/assistant/guide"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func Tools(screens []guide.Screen, calculators []Calculator, base BaseCurrency) []tool.Tool {
	return []tool.Tool{getHelp(screens), openCalculator(calculators, base)}
}
