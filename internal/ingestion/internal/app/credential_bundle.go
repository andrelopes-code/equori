package app

import (
	"context"

	"github.com/google/uuid"
)

// ExportCredentials returns the credentials of the book in the clear, by integration id, for the
// credentials bundle of an export archive (export design C2, T3). A credential that no longer
// opens with the instance key is left out: it is unusable where it is (ADR 008).
func (s *Service) ExportCredentials(ctx context.Context, booksID int64) (map[uuid.UUID]map[string]string, error) {
	if err := s.available(); err != nil {
		return nil, err
	}

	stored, err := s.repo.StoredCredentials(ctx, booksID)
	if err != nil {
		return nil, err
	}

	out := map[uuid.UUID]map[string]string{}

	for _, i := range stored {
		if c, err := s.credentials(i); err == nil {
			out[i.ID] = c
		}
	}

	return out, nil
}

// SealCredentials seals each credential for booksID and its integration id under the key of this
// instance (export design C6).
func (s *Service) SealCredentials(booksID int64, plain map[uuid.UUID]map[string]string) (map[uuid.UUID][]byte, error) {
	if err := s.available(); err != nil {
		return nil, err
	}

	out := make(map[uuid.UUID][]byte, len(plain))

	for id, c := range plain {
		sealed, err := s.seal(booksID, id, c)
		if err != nil {
			return nil, err
		}

		out[id] = sealed
	}

	return out, nil
}
