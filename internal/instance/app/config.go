package app

import (
	"context"

	"github.com/andrelopes-code/equori/internal/instance/domain"
	"github.com/andrelopes-code/equori/internal/platform/logring"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// Config is what the service needs from the module's configuration.
type Config struct {
	BackupDir string
	CopyDir   string
	Dump      func(ctx context.Context, path string) error
	// Schema is the schema version of the binary.
	Schema int64
	Mode   string
	// Distribution is EQUORI_DISTRIBUTION (A194.1).
	Distribution string
	Version      string
	Environment  []string
	Log          func() []logring.Record
	Outbox       func(ctx context.Context) ([]outbox.Count, error)
	Connections  func(ctx context.Context) ([]domain.Connection, error)
}
