package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/instance/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// getDiagnostic is a custom handler: the response sets Content-Disposition.
func (s *Server) getDiagnostic(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	d, err := s.svc.Diagnostic(ctx, auth.MustMemberID(ctx))
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(toDiagnostic(d)); err != nil {
		s.errs.Write(w, r, err)

		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set(
		"Content-Disposition",
		`attachment; filename="equori-diagnostic-`+d.GeneratedAt.Format(time.DateOnly)+`.json"`,
	)
	w.WriteHeader(http.StatusOK)
	_, _ = buf.WriteTo(w)
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
