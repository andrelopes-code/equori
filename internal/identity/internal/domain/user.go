// Package domain holds identity entities and their invariants.
package domain

import (
	"errors"
	"net/mail"
	"strings"
	"unicode/utf8"
)

type Role string

const (
	RoleAdmin  Role = "admin"
	RoleMember Role = "member"
)

func (r Role) Valid() bool { return r == RoleAdmin || r == RoleMember }

type User struct {
	ID           int64
	Email        string
	PasswordHash string
	Role         Role
	Language     string
	Region       string
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

func ValidatePassword(p string) error {
	switch n := utf8.RuneCountInString(p); {
	case n < MinPasswordLength:
		return ErrPasswordTooShort
	case n > MaxPasswordLength:
		return ErrPasswordTooLong
	}
	return nil
}
