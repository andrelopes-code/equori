package httpapi

import (
	"context"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/instance/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) GetDiagnostic(ctx context.Context, _ GetDiagnosticRequestObject) (GetDiagnosticResponseObject, error) {
	d, err := s.svc.Diagnostic(ctx, auth.MustMemberID(ctx))
	if err != nil {
		return nil, err
	}

	disposition := `attachment; filename="equori-diagnostic-` + d.GeneratedAt.Format(time.DateOnly) + `.json"`

	return GetDiagnostic200JSONResponse{
		Body:    toDiagnostic(d),
		Headers: GetDiagnostic200ResponseHeaders{ContentDisposition: &disposition},
	}, nil
}

func toDiagnostic(d domain.Diagnostic) Diagnostic {
	out := Diagnostic{
		GeneratedAt: d.GeneratedAt, Version: d.Version, Go: d.Go, Os: d.OS, Arch: d.Arch,
		Mode: DiagnosticMode(d.Mode), Environment: append([]string{}, d.Environment...),
	}

	out.Schema.Database, out.Schema.Binary = d.Server.Schema, d.BinarySchema
	out.Postgres.Version, out.Postgres.LocaleProvider, out.Postgres.Locale = d.Server.PostgresVersion, d.Server.LocaleProvider, d.Server.Locale
	out.Backup.Backups = toBackupStatus(d.Backup).Backups
	out.Backup.Copy.State, out.Backup.Copy.CopiedAt, out.Backup.Copy.Late = string(d.Backup.Copy.State), d.Backup.Copy.CopiedAt, d.Backup.Copy.Late

	// sized gives each list an element type it cannot name: oapi-codegen declares it inline.
	out.Tables = sized(out.Tables, len(d.Tables))
	for i, t := range d.Tables {
		out.Tables[i].Name, out.Tables[i].Rows = t.Name, t.Rows
	}

	out.Connections = sized(out.Connections, len(d.Connections))
	for i, c := range d.Connections {
		e := &out.Connections[i]
		e.Id, e.Aggregator, e.State, e.LastUpdate, e.Failed = c.ID, c.Aggregator, c.State, c.LastUpdate, c.Failed
	}

	out.Outbox = sized(out.Outbox, len(d.Outbox))
	for i, c := range d.Outbox {
		out.Outbox[i].Type, out.Outbox[i].Pending, out.Outbox[i].Failed = c.Type, c.Pending, c.Failed
	}

	out.Log = sized(out.Log, len(d.Log))
	for i, r := range d.Log {
		e := &out.Log[i]
		e.Time, e.Level, e.Message, e.Attrs = r.Time, r.Level, r.Message, r.Attrs
	}

	return out
}

// sized returns n zero elements in a non-nil slice, so an empty list encodes as [] and not null.
func sized[E any](like []E, n int) []E { return slices.Grow(like[:0], max(n, 1))[:n] }
