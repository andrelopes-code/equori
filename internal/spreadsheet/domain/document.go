// Package domain holds the rules of a spreadsheet document.
package domain

import (
	"errors"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
)

const (
	// MaxDocuments is the number of documents a book holds (spreadsheets design SS4).
	MaxDocuments = 40
	// MaxContentBytes is the size of the JSON text of one content (SS4). MaxDocuments times
	// MaxContentBytes stays under the largest archive an export writes.
	MaxContentBytes = 4 << 20

	maxNameLength = 120
)

var ErrValidation = errors.New("validation failed")

// FieldError names the input field that broke a rule.
type FieldError struct {
	Field   string
	Message string
}

func (e *FieldError) Error() string { return e.Field + ": " + e.Message }
func (e *FieldError) Unwrap() error { return ErrValidation }

// Summary is a document without its content.
type Summary struct {
	ID        uuid.UUID
	Name      string
	Version   int
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Document is one spreadsheet of a book. Content is the JSON object the editor wrote.
type Document struct {
	Summary

	Content []byte
}

// NewName trims name and checks it holds 1 to 120 characters, none of them a control character.
func NewName(name string) (string, error) {
	name = strings.TrimSpace(name)

	switch {
	case name == "":
		return "", &FieldError{Field: "name", Message: "is required"}
	case utf8.RuneCountInString(name) > maxNameLength:
		return "", &FieldError{Field: "name", Message: "has more than 120 characters"}
	case strings.ContainsFunc(name, unicode.IsControl):
		return "", &FieldError{Field: "name", Message: "holds a control character"}
	}

	return name, nil
}
