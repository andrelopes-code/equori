package marketdata

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
)

// HiddenInstruments returns the codes the book keeps out of its lists (A238 HD1).
func (m *Module) HiddenInstruments(ctx context.Context, booksID int64) (map[string]bool, error) {
	codes, err := m.q.ListHiddenInstruments(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("list hidden instruments: %w", err)
	}

	hidden := make(map[string]bool, len(codes))
	for _, code := range codes {
		hidden[code] = true
	}

	return hidden, nil
}

// HideInstrument keeps a security out of the lists of the book; hiding twice changes nothing
// (A238 HD2).
func (m *Module) HideInstrument(ctx context.Context, booksID int64, code string) error {
	if err := m.hideable(ctx, code); err != nil {
		return err
	}

	if err := m.q.HideInstrument(
		ctx,
		postgres.HideInstrumentParams{BooksID: booksID, Instrument: code},
	); err != nil {
		return fmt.Errorf("hide instrument: %w", err)
	}

	return nil
}

// ShowInstrument returns a hidden security to the lists of the book (A238 HD2).
func (m *Module) ShowInstrument(ctx context.Context, booksID int64, code string) error {
	if err := m.hideable(ctx, code); err != nil {
		return err
	}

	if err := m.q.ShowInstrument(
		ctx,
		postgres.ShowInstrumentParams{BooksID: booksID, Instrument: code},
	); err != nil {
		return fmt.Errorf("show instrument: %w", err)
	}

	return nil
}

// hideable rejects an unknown code and a currency, which has no entry in the lists to hide.
func (m *Module) hideable(ctx context.Context, code string) error {
	in, err := m.Instrument(ctx, code)
	if err != nil {
		return err
	}

	if in.Type == domain.TypeCurrency {
		return &domain.FieldError{Field: "code", Message: "is a currency"}
	}

	return nil
}
