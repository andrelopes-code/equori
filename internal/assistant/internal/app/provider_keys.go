package app

import (
	"context"

	"github.com/google/uuid"
)

// ExportProviderKeys returns, by provider id, the keys of the book that open under the instance
// key. A provider without a key and a key that does not open are left out: the second is unusable
// where it is (export design T3).
func (s *Service) ExportProviderKeys(ctx context.Context, booksID int64) (map[uuid.UUID]string, error) {
	if s.box == nil {
		return nil, ErrSecretKeyMissing
	}

	providers, err := s.repo.Providers(ctx, booksID)
	if err != nil {
		return nil, err
	}

	keys := map[uuid.UUID]string{}

	for _, p := range providers {
		if key, err := s.open(p); err == nil && key != "" {
			keys[p.ID] = key
		}
	}

	return keys, nil
}

// SealProviderKeys seals each key for booksID and its provider id under the key of this instance
// (export design T5).
func (s *Service) SealProviderKeys(booksID int64, keys map[uuid.UUID]string) (map[uuid.UUID][]byte, error) {
	sealed := make(map[uuid.UUID][]byte, len(keys))

	for id, key := range keys {
		b, err := s.seal(booksID, id, key)
		if err != nil {
			return nil, err
		}

		sealed[id] = b
	}

	return sealed, nil
}
