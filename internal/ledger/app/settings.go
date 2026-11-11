package app

import (
	"context"
	"errors"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Provision creates the settings and system accounts of a new book. It is idempotent.
func (s *Service) Provision(ctx context.Context, booksID int64, base money.Currency) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		if _, err := r.Settings(ctx, booksID); err == nil {
			return nil
		} else if !errors.Is(err, ErrNotFound) {
			return err
		}

		if err := r.SaveSettings(ctx, Settings{BooksID: booksID, BaseCurrency: base}); err != nil {
			return err
		}

		for _, role := range domain.SystemRoles() {
			a, err := domain.NewAccount(domain.Account{
				BooksID: booksID, Name: role.DefaultName(), Class: role.Class(),
				Instrument: base, OpenedOn: earliestDate, SystemRole: role,
			})
			if err != nil {
				return err
			}

			if _, err := r.InsertAccount(ctx, a); err != nil {
				return err
			}
		}

		return nil
	})
}

func (s *Service) Settings(ctx context.Context, booksID int64) (Settings, error) {
	return s.repo.Settings(ctx, booksID)
}

// SetBaseCurrency is allowed only while the book has no transaction; system accounts follow the new currency.
func (s *Service) SetBaseCurrency(ctx context.Context, booksID int64, c money.Currency) error {
	if _, err := money.ParseCurrency(string(c)); err != nil {
		return &domain.FieldError{Field: "base_currency", Message: "must be a supported currency", Err: domain.ErrValidation}
	}

	return s.repo.InTx(ctx, func(r Repository) error {
		n, err := r.CountTransactions(ctx, booksID)
		if err != nil {
			return err
		}

		if n > 0 {
			return ErrSettingsLocked
		}

		if err := r.SaveSettings(ctx, Settings{BooksID: booksID, BaseCurrency: c}); err != nil {
			return err
		}

		return r.SetSystemAccountsInstrument(ctx, booksID, c)
	})
}
