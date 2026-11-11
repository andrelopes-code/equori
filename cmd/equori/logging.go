package main

import (
	"log/slog"
	"os"

	"github.com/andrelopes-code/equori/internal/instance"
	"github.com/andrelopes-code/equori/internal/platform/config"
	"github.com/andrelopes-code/equori/internal/platform/logring"
	"github.com/andrelopes-code/equori/internal/platform/prettylog"
)

func newLogger(cfg config.Config) *slog.Logger {
	return slog.New(logHandler(cfg))
}

// withLogRing returns the ring that keeps the recent records and the logger that feeds it.
func withLogRing(log *slog.Logger) (*logring.Ring, *slog.Logger) {
	ring := logring.New(log.Handler(), instance.LogRecordsKept, instance.LogKeys)

	return ring, slog.New(ring)
}

func logHandler(cfg config.Config) slog.Handler {
	opts := &slog.HandlerOptions{Level: cfg.LogLevel}
	switch cfg.LogFormat {
	case "text":
		return slog.NewTextHandler(os.Stdout, opts)
	case "pretty":
		return prettylog.New(os.Stdout, cfg.LogLevel, os.Getenv("NO_COLOR") == "")
	}

	return slog.NewJSONHandler(os.Stdout, opts)
}
