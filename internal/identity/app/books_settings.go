// Package app implements the identity use cases.
package app

import (
	"context"
	"fmt"
	"time"
	"unicode/utf8"

	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const maxBooksNameLength = 80

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

	return BooksSettings{
		Name:            name,
		Region:          region,
		TimeZone:        timeZone,
		DefaultTimeZone: s.defaultTimeZone(region),
	}, nil
}

// UpdateBooksSettings validates and stores the name, the region and the time zone; a nil name keeps
// the stored one and a nil timeZone restores the default of the region.
func (s *Service) UpdateBooksSettings(
	ctx context.Context,
	booksID int64,
	region string,
	timeZone, name *string,
) (BooksSettings, error) {
	if err := checkBooksSettings(region, timeZone, name); err != nil {
		return BooksSettings{}, err
	}

	stored, err := s.repo.UpdateBooksSettings(ctx, booksID, region, timeZone, name)
	if err != nil {
		return BooksSettings{}, fmt.Errorf("update settings of books %d: %w", booksID, err)
	}

	return BooksSettings{
		Name:            stored,
		Region:          region,
		TimeZone:        timeZone,
		DefaultTimeZone: s.defaultTimeZone(region),
	}, nil
}

// BooksSettingsPatch names the settings a change gives. A nil field keeps the stored value; a
// TimeZone that points to "" restores the default of the region.
type BooksSettingsPatch struct {
	Name, Region, TimeZone *string
}

// BooksSettingsChange returns the settings before and after PatchBooksSettings with the same
// patch, validated, without storing anything.
func (s *Service) BooksSettingsChange(
	ctx context.Context,
	booksID int64,
	p BooksSettingsPatch,
) (before, after BooksSettings, err error) {
	before, err = s.BooksSettings(ctx, booksID)
	if err != nil {
		return BooksSettings{}, BooksSettings{}, err
	}

	after = before
	if p.Name != nil {
		after.Name = *p.Name
	}

	if p.Region != nil {
		after.Region = *p.Region
	}

	if p.TimeZone != nil {
		after.TimeZone = p.TimeZone
		if *p.TimeZone == "" {
			after.TimeZone = nil
		}
	}

	after.DefaultTimeZone = s.defaultTimeZone(after.Region)

	return before, after, checkBooksSettings(after.Region, after.TimeZone, p.Name)
}

// PatchBooksSettings stores the settings the patch gives and keeps the others.
func (s *Service) PatchBooksSettings(
	ctx context.Context,
	booksID int64,
	p BooksSettingsPatch,
) (BooksSettings, error) {
	_, after, err := s.BooksSettingsChange(ctx, booksID, p)
	if err != nil {
		return BooksSettings{}, err
	}

	return s.UpdateBooksSettings(ctx, booksID, after.Region, after.TimeZone, p.Name)
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
		return &domain.FieldError{
			Field:   "base_currency",
			Message: "must be an ISO 4217 currency code",
		}
	}

	return nil
}

// checkBooksSettings validates the region, the time zone and, when given, the name (1 to 80
// characters, the check of identity_books).
func checkBooksSettings(region string, timeZone, name *string) error {
	if !locale.ValidRegion(region) {
		return &domain.FieldError{
			Field:   "region",
			Message: "must be an ISO 3166-1 alpha-2 code",
		}
	}

	if timeZone != nil && !validTimeZone(*timeZone) {
		return ErrTimeZoneInvalid
	}

	if name != nil {
		if n := utf8.RuneCountInString(*name); n == 0 || n > maxBooksNameLength {
			return &domain.FieldError{Field: "name", Message: "must have 1 to 80 characters"}
		}
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
