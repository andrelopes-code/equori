// Package app implements the identity use cases.
package app

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

// Profile returns the language and region of the books for the member (BK27).
func (s *Service) Profile(ctx context.Context, booksID, memberID int64) (locale.Locale, error) {
	l, err := s.repo.Locale(ctx, booksID, memberID)
	if err != nil {
		return locale.Locale{}, fmt.Errorf("load locale of books %d: %w", booksID, err)
	}

	return l, nil
}

// ProfileChange returns the language and region before and after UpdateProfile with the
// same arguments, validated, without storing anything.
func (s *Service) ProfileChange(ctx context.Context, booksID, memberID int64, language, region string) (before, after locale.Locale, err error) {
	before, err = s.Profile(ctx, booksID, memberID)
	if err != nil {
		return locale.Locale{}, locale.Locale{}, err
	}

	after = before
	if language != "" {
		after.Language = language
	}

	if region != "" {
		after.Region = region
	}

	return before, after, validateLocale(after)
}

// UpdateProfile changes the language of the member and the region of the books; an empty field keeps the stored value.
func (s *Service) UpdateProfile(ctx context.Context, booksID, memberID int64, language, region string) (locale.Locale, error) {
	_, l, err := s.ProfileChange(ctx, booksID, memberID, language, region)
	if err != nil {
		return locale.Locale{}, err
	}

	if err := s.repo.UpdateProfile(ctx, memberID, booksID, l); err != nil {
		return locale.Locale{}, err
	}

	return l, nil
}

// Appearance returns the stored JSON object of the member.
func (s *Service) Appearance(ctx context.Context, memberID int64) ([]byte, error) {
	doc, err := s.repo.Appearance(ctx, memberID)
	if err != nil {
		return nil, fmt.Errorf("load appearance of member %d: %w", memberID, err)
	}

	return doc, nil
}

// SetAppearance stores the JSON object of the member; ErrAppearanceTooLarge when it is over
// MaxAppearanceBytes.
func (s *Service) SetAppearance(ctx context.Context, memberID int64, doc []byte) error {
	if len(doc) > MaxAppearanceBytes {
		return ErrAppearanceTooLarge
	}

	if err := s.repo.SetAppearance(ctx, memberID, doc); err != nil {
		return fmt.Errorf("store appearance of member %d: %w", memberID, err)
	}

	return nil
}

func validateLocale(l locale.Locale) error {
	if err := validateLanguage(l.Language); err != nil {
		return err
	}

	return validateRegion(l.Region)
}

func validateLanguage(language string) error {
	if !locale.ValidLanguage(language) {
		return &domain.FieldError{Field: "language", Message: "must be an ISO 639 language code"}
	}

	return nil
}

func validateRegion(region string) error {
	if !locale.ValidRegion(region) {
		return &domain.FieldError{Field: "region", Message: "must be an ISO 3166-1 alpha-2 code"}
	}

	return nil
}
