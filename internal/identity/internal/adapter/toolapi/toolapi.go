// Package toolapi declares the identity module's tools for language models (ADR 012).
package toolapi

import (
	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func Tools(svc *app.Service) []tool.Tool {
	return []tool.Tool{updateProfile(svc)}
}
