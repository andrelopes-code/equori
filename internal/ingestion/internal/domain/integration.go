package domain

import (
	"log/slog"
	"maps"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

type AggregatorID string

// Integration is one aggregator application of a user (P6 amendment A34). Its credentials
// travel only sealed (ADR 008).
type Integration struct {
	ID                uuid.UUID
	UserID            int64
	Aggregator        AggregatorID
	Name              string
	SealedCredentials []byte
	UpdatedAt         time.Time
}

const maxNameLength = 60

func NewIntegration(id uuid.UUID, userID int64, p AggregatorID, name string) (Integration, error) {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > maxNameLength {
		return Integration{}, invalid("name", "must have 1 to 60 characters")
	}
	return Integration{ID: id, UserID: userID, Aggregator: p, Name: name}, nil
}

// Credentials of an aggregator application, one value per declared field. String,
// GoString and LogValue keep them out of formatted errors and logs (A44).
type Credentials map[string]string

func (Credentials) String() string   { return "credentials" }
func (Credentials) GoString() string { return "credentials" }

func (Credentials) LogValue() slog.Value { return slog.StringValue("credentials") }

// Validate requires every declared field and rejects any other member.
func (c Credentials) Validate(fields []CredentialField) error {
	declared := make(map[string]bool, len(fields))
	for _, f := range fields {
		declared[f.Name] = true
		if c[f.Name] == "" {
			return invalid("credentials."+f.Name, "is required")
		}
	}
	for _, name := range slices.Sorted(maps.Keys(c)) {
		if !declared[name] {
			return invalid("credentials."+name, "is not a field of this aggregator")
		}
	}
	return nil
}
