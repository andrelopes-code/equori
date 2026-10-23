// Package toolapi declares the reporting module's tools for language models (ADR 012).
package toolapi

import (
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

func Tools(svc *app.Service) []tool.Tool {
	return []tool.Tool{getCategoryTotals(svc), getAccountHistory(svc)}
}
