package assistant

import (
	"context"

	"github.com/google/uuid"
)

// RotateSecrets reseals every stored provider key under the current key (ADR 008 K4).
func (m *Module) RotateSecrets(ctx context.Context) (int, error) { return m.svc.RotateSecrets(ctx) }

// ExportProviderKeys returns the keys of a book's providers in the clear, by provider id, for the
// credentials bundle of an export archive (export design T3). The caller seals them under a passphrase.
func (m *Module) ExportProviderKeys(ctx context.Context, booksID int64) (map[uuid.UUID]string, error) {
	return m.svc.ExportProviderKeys(ctx, booksID)
}

// SealProviderKeys seals each key for booksID under the key of this instance, by provider id
// (export design T5).
func (m *Module) SealProviderKeys(booksID int64, keys map[uuid.UUID]string) (map[uuid.UUID][]byte, error) {
	return m.svc.SealProviderKeys(booksID, keys)
}
