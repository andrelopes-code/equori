package ingestion

import (
	"context"

	"github.com/google/uuid"
)

// RotateSecrets reseals every stored credential under the current key (ADR 008 K4) and
// returns how many changed.
func (m *Module) RotateSecrets(ctx context.Context) (int, error) { return m.svc.RotateSecrets(ctx) }

// ExportCredentials returns the credentials of a book in the clear, by integration id, for the
// credentials bundle of an export archive (export design C2, T3). The caller seals them under a passphrase.
func (m *Module) ExportCredentials(
	ctx context.Context,
	booksID int64,
) (map[uuid.UUID]map[string]string, error) {
	return m.svc.ExportCredentials(ctx, booksID)
}

// SealCredentials seals each credential for booksID under this instance's key, by integration id
// (export design C6).
func (m *Module) SealCredentials(
	booksID int64,
	plain map[uuid.UUID]map[string]string,
) (map[uuid.UUID][]byte, error) {
	return m.svc.SealCredentials(booksID, plain)
}
