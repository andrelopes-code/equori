package reporting

import (
	"context"
)

// OnImport adds the rebuild of another module's derived tables, run for the book after an
// import of an export archive (export design E4).
func (m *Module) OnImport(rebuild func(ctx context.Context, booksID int64) error) {
	m.exports.OnImport(rebuild)
}

// UseCredentials lends the credentials of the integrations; internal/server binds them late
// because ingestion is built after reporting.
func (m *Module) UseCredentials(c Credentials) { m.exports.UseCredentials(c) }
