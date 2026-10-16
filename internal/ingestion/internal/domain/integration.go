package domain

import (
	"log/slog"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

type Provider string

const ProviderPluggy Provider = "pluggy"

// Integration is one aggregator application of a user (P6 amendment A34). Its credentials
// travel only sealed (ADR 008).
type Integration struct {
	ID                uuid.UUID
	UserID            int64
	Provider          Provider
	Name              string
	SealedCredentials []byte
	UpdatedAt         time.Time
}

const maxNameLength = 60

func NewIntegration(id uuid.UUID, userID int64, p Provider, name string) (Integration, error) {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > maxNameLength {
		return Integration{}, invalid("name", "must have 1 to 60 characters")
	}
	return Integration{ID: id, UserID: userID, Provider: p, Name: name}, nil
}

// Credentials of an aggregator application. String, GoString and LogValue keep them out
// of formatted errors and logs (A44).
type Credentials struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
}

func (Credentials) String() string   { return "credentials" }
func (Credentials) GoString() string { return "credentials" }

func (Credentials) LogValue() slog.Value { return slog.StringValue("credentials") }
