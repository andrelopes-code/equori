package app

import (
	"context"
	"runtime"

	"github.com/andrelopes-code/equori/internal/instance/internal/domain"
)

// Diagnostic assembles the diagnostic file for an admin (A158).
func (s *Service) Diagnostic(ctx context.Context, memberID int64) (domain.Diagnostic, error) {
	if err := s.requireAdmin(ctx, memberID); err != nil {
		return domain.Diagnostic{}, err
	}

	server, err := s.catalog.Server(ctx)
	if err != nil {
		return domain.Diagnostic{}, err
	}

	tables, err := s.catalog.Tables(ctx)
	if err != nil {
		return domain.Diagnostic{}, err
	}

	backups, err := s.backupStatus(ctx)
	if err != nil {
		return domain.Diagnostic{}, err
	}

	connections, err := s.cfg.Connections(ctx)
	if err != nil {
		return domain.Diagnostic{}, err
	}

	counts, err := s.cfg.Outbox(ctx)
	if err != nil {
		return domain.Diagnostic{}, err
	}

	d := domain.Diagnostic{
		GeneratedAt: s.clock.Now().UTC(), Version: s.cfg.Version, BinarySchema: s.cfg.Schema,
		Go: runtime.Version(), OS: runtime.GOOS, Arch: runtime.GOARCH, Mode: s.cfg.Mode,
		Server: server, Environment: s.cfg.Environment, Tables: tables, Backup: backups,
		Connections: connections,
	}

	for _, c := range counts {
		d.Outbox = append(d.Outbox, domain.OutboxCount{Type: c.Type, Pending: c.Pending, Failed: c.Failed})
	}

	for _, r := range s.cfg.Log() {
		d.Log = append(d.Log, domain.LogRecord{
			Time: r.Time, Level: r.Level.String(), Message: r.Message, Attrs: r.Attrs,
		})
	}

	return d, nil
}
