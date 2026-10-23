package domain

import (
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

// Provider is one language model service of a user. Its key travels only sealed (ADR 008).
type Provider struct {
	ID        uuid.UUID
	UserID    int64
	Preset    string
	Name      string
	BaseURL   string
	SealedKey []byte
	CreatedAt time.Time
}

const maxNameLength = 60

// NewProvider validates a provider; an empty baseURL takes the preset's.
func NewProvider(id uuid.UUID, userID int64, preset, name, baseURL string, hasKey bool, now time.Time) (Provider, error) {
	p, ok := FindPreset(preset)
	if !ok {
		return Provider{}, invalid("preset", "is not a known preset")
	}
	out := Provider{ID: id, UserID: userID, Preset: preset, CreatedAt: now}
	if err := out.Rename(name); err != nil {
		return Provider{}, err
	}
	if baseURL == "" {
		baseURL = p.BaseURL
	}
	if err := out.Move(baseURL); err != nil {
		return Provider{}, err
	}
	if p.KeyRequired && !hasKey {
		return Provider{}, ErrKeyRequired
	}
	return out, nil
}

func (p *Provider) Rename(name string) error {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > maxNameLength {
		return invalid("name", "must have 1 to 60 characters")
	}
	p.Name = name
	return nil
}

func (p *Provider) Move(baseURL string) error {
	u, err := ValidateBaseURL(baseURL)
	if err != nil {
		return err
	}
	p.BaseURL = u
	return nil
}

// KeyRequired reports whether the provider's preset needs a key.
func (p Provider) KeyRequired() bool {
	preset, _ := FindPreset(p.Preset)
	return preset.KeyRequired
}

// ValidateBaseURL accepts an http or https URL with a host and without user info, query or
// fragment, and returns it without a trailing slash. Loopback and private hosts are
// accepted: local models run there.
func ValidateBaseURL(raw string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" ||
		u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.ForceQuery {
		return "", invalid("base_url", "must be an http or https URL with a host and no credentials, query or fragment")
	}
	return strings.TrimSuffix(u.String(), "/"), nil
}
