// Package domain holds identity entities and their invariants.
package domain

import (
	"errors"
	"net/mail"
	"strings"
	"unicode"
	"unicode/utf8"
)

type Role string

const (
	RoleAdmin  Role = "admin"
	RoleMember Role = "member"
)

const (
	maxBooksName   = 80
	maxDisplayName = 60
)

func (r Role) Valid() bool { return r == RoleAdmin || r == RoleMember }

type Member struct {
	ID           int64
	Email        string
	PasswordHash string
	Role         Role
	Language     string
	DisplayName  string
	Disabled     bool
}

// FieldError names the request field that failed validation, as in the API.
type FieldError struct {
	Field   string
	Message string
}

func (e *FieldError) Error() string { return e.Field + ": " + e.Message }

const (
	MinPasswordLength = 12
	// MaxPasswordLength bounds the argon2id input, so a login request cannot force an arbitrarily long hash.
	MaxPasswordLength = 256
)

var (
	ErrInvalidEmail     = errors.New("invalid email")
	ErrPasswordTooShort = errors.New("password must have at least 12 characters")
	ErrPasswordTooLong  = errors.New("password must have at most 256 characters")
	ErrInvalidRole      = errors.New("invalid role")
)

// NormalizeEmail returns the trimmed, lowercased address. Display names ("Ann <a@b.c>") are rejected.
func NormalizeEmail(s string) (string, error) {
	s = strings.ToLower(strings.TrimSpace(s))

	addr, err := mail.ParseAddress(s)
	if err != nil || addr.Address != s {
		return "", ErrInvalidEmail
	}

	return s, nil
}

// NormalizeDisplayName returns the trimmed name; an empty result clears the name.
func NormalizeDisplayName(s string) (string, error) {
	s = strings.TrimSpace(s)

	if utf8.RuneCountInString(s) > maxDisplayName {
		return "", &FieldError{Field: "display_name", Message: "must have at most 60 characters"}
	}

	if strings.ContainsFunc(s, unicode.IsControl) {
		return "", &FieldError{Field: "display_name", Message: "must not contain control characters"}
	}

	return s, nil
}

// DefaultBooksName is the name of a book created without one: the email cut to 80 characters (HA1).
func DefaultBooksName(email string) string {
	runes := []rune(email)
	if len(runes) > maxBooksName {
		return string(runes[:maxBooksName])
	}

	return email
}

func ValidatePassword(p string) error {
	switch n := utf8.RuneCountInString(p); {
	case n < MinPasswordLength:
		return ErrPasswordTooShort
	case n > MaxPasswordLength:
		return ErrPasswordTooLong
	}

	return nil
}
