package app

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/secret"
)

// ErrPassphraseInvalid: the bundle does not open with the passphrase, or does not read.
var ErrPassphraseInvalid = errors.New("the passphrase does not open the credentials")

// credentialBundle is the plaintext of the archive entry credentials.enc (export design C3).
type credentialBundle struct {
	Credentials map[uuid.UUID]domain.Credentials `json:"credentials"`
}

// CredentialBundle seals the credentials of the book under passphrase, to travel in an export
// archive; nil when the book stores none. A credential that no longer opens with the instance key
// is left out: it is unusable where it is (ADR 008).
func (s *Service) CredentialBundle(ctx context.Context, booksID int64, passphrase string) ([]byte, error) {
	if err := s.available(); err != nil {
		return nil, err
	}

	stored, err := s.repo.StoredCredentials(ctx, booksID)
	if err != nil {
		return nil, err
	}

	bundle := credentialBundle{Credentials: map[uuid.UUID]domain.Credentials{}}

	for _, i := range stored {
		if c, err := s.credentials(i); err == nil {
			bundle.Credentials[i.ID] = c
		}
	}

	if len(bundle.Credentials) == 0 {
		return nil, nil
	}

	plain, err := json.Marshal(bundle)
	if err != nil {
		return nil, err
	}

	return secret.SealWithPassphrase(plain, passphrase)
}

// ResealBundle opens a bundle of CredentialBundle and seals each credential for booksID under the
// key of this instance, by integration id (export design C6).
func (s *Service) ResealBundle(booksID int64, passphrase string, bundle []byte) (map[uuid.UUID][]byte, error) {
	if err := s.available(); err != nil {
		return nil, err
	}

	plain, err := secret.OpenWithPassphrase(bundle, passphrase)
	if err != nil {
		return nil, ErrPassphraseInvalid
	}

	var b credentialBundle
	if err := json.Unmarshal(plain, &b); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrPassphraseInvalid, err)
	}

	out := make(map[uuid.UUID][]byte, len(b.Credentials))

	for id, c := range b.Credentials {
		if out[id], err = s.seal(booksID, id, c); err != nil {
			return nil, err
		}
	}

	return out, nil
}
