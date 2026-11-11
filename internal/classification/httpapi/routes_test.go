package httpapi

import (
	"io"
	"log/slog"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/httpserver/routetest"
)

func TestEveryOperationHasARoute(t *testing.T) {
	server := NewServer(nil, slog.New(slog.NewTextHandler(io.Discard, nil)))

	routetest.Check(t, "classification", BaseURL, server.Register)
}
