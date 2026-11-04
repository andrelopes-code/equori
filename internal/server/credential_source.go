package server

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion"
	"github.com/andrelopes-code/equori/internal/reporting"
)

// credentialSource lends the credentials of ingestion to the export of reporting (export design C2, C6).
type credentialSource struct{ in *ingestion.Module }

func (s credentialSource) Bundle(ctx context.Context, booksID int64, passphrase string) ([]byte, error) {
	b, err := s.in.CredentialBundle(ctx, booksID, passphrase)

	return b, credentialError(err)
}

func (s credentialSource) Reseal(booksID int64, passphrase string, bundle []byte) (map[uuid.UUID][]byte, error) {
	sealed, err := s.in.ResealBundle(booksID, passphrase, bundle)

	return sealed, credentialError(err)
}

// credentialError names an error of ingestion in the terms of reporting.
func credentialError(err error) error {
	switch {
	case errors.Is(err, ingestion.ErrIntegrationUnavailable):
		return reporting.ErrCredentialsUnavailable
	case errors.Is(err, ingestion.ErrPassphraseInvalid):
		return reporting.ErrPassphraseInvalid
	}

	return err
}
