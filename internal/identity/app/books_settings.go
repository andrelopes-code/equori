// Package app implements the identity use cases.
package app

import (
	"context"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// BooksSettings are the settings of one book (BK22).
type BooksSettings struct {
	Name   string
	Region string
	// TimeZone is nil while the book uses DefaultTimeZone.
	TimeZone        *string
	DefaultTimeZone string
}

// BooksSettings returns the region and the time zone of the books.
func (s *Service) BooksSettings(ctx context.Context, booksID int64) (BooksSettings, error) {
	region, timeZone, err := s.repo.BooksZone(ctx, booksID)
	if err != nil {
		return BooksSettings{}, fmt.Errorf("load settings of books %d: %w", booksID, err)
	}

	name, err := s.repo.BooksName(ctx, booksID)
	if err != nil {
		return BooksSettings{}, fmt.Errorf("load name of books %d: %w", booksID, err)
	}

	return BooksSettings{Name: name, Region: region, TimeZone: timeZone, DefaultTimeZone: s.defaultTimeZone(region)}, nil
}

// UpdateBooksSettings validates and stores the name, the region and the time zone; a nil name keeps
// the stored one and a nil timeZone restores the default of the region.
func (s *Service) UpdateBooksSettings(ctx context.Context, booksID int64, region string, timeZone, name *string) (BooksSettings, error) {
	if !locale.ValidRegion(region) {
		return BooksSettings{}, &domain.FieldError{Field: "region", Message: "must be an ISO 3166-1 alpha-2 code"}
	}

	if timeZone != nil && !validTimeZone(*timeZone) {
		return BooksSettings{}, ErrTimeZoneInvalid
	}

	stored, err := s.repo.UpdateBooksSettings(ctx, booksID, region, timeZone, name)
	if err != nil {
		return BooksSettings{}, fmt.Errorf("update settings of books %d: %w", booksID, err)
	}

	return BooksSettings{Name: stored, Region: region, TimeZone: timeZone, DefaultTimeZone: s.defaultTimeZone(region)}, nil
}

// Location returns the book's time_zone, or the default of its region while null.
func (s *Service) Location(ctx context.Context, booksID int64) (*time.Location, error) {
	region, timeZone, err := s.repo.BooksZone(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("load time zone of books %d: %w", booksID, err)
	}

	name := s.defaultTimeZone(region)
	if timeZone != nil {
		name = *timeZone
	}

	loc, err := time.LoadLocation(name)
	if err != nil {
		return nil, fmt.Errorf("load location of books %d: %w", booksID, err)
	}

	return loc, nil
}

// validateBooks checks the region and the base currency of a new book.
func validateBooks(region string, base money.Currency) error {
	if err := validateRegion(region); err != nil {
		return err
	}

	if _, err := money.ParseCurrency(string(base)); err != nil {
		return &domain.FieldError{Field: "base_currency", Message: "must be an ISO 4217 currency code"}
	}

	return nil
}

// validTimeZone rejects the empty name and "Local", which LoadLocation accepts.
func validTimeZone(name string) bool {
	if name == "" || name == "Local" {
		return false
	}

	_, err := time.LoadLocation(name)

	return err == nil
}
