package assistant_test

import (
	"log/slog"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/web"
)

func TestNewCalculatorsNeedBaseCurrency(t *testing.T) {
	t.Parallel()

	_, err := assistant.New(
		nil,
		assistant.Config{Calculators: web.CalculatorKeys()},
		slog.New(slog.DiscardHandler),
	)
	if err == nil || !strings.Contains(err.Error(), "base currency") {
		t.Fatalf("New error = %v, want one that names the base currency", err)
	}
}
