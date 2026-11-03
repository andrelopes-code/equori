// Package config loads process configuration from environment variables.
package config

import (
	"cmp"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
)

const (
	reportHeader  = "invalid configuration (docs/install/configuration.md):"
	idPlaceholder = "<ID>"
)

type Config struct {
	DatabaseURL string
	// DataDir, PostgresBin and BackupDir serve managed mode (ADR 022, M1 to M3); DataDir is empty
	// in external mode.
	DataDir, PostgresBin, BackupDir string
	// CopyDir is the container path of the encrypted copy folder (P13 A155.1); empty when unset.
	CopyDir  string
	HTTPAddr string
	LogLevel slog.Level
	// InsecureCookies drops the Secure cookie attribute for plain-HTTP LAN deployments (ADR 003).
	InsecureCookies bool
	// Distribution is EQUORI_DISTRIBUTION, which compose.yaml sets to compose (A194.1).
	Distribution string
	// APIDocs serves the API reference at /docs and the contract at /openapi.yaml without a session.
	APIDocs bool
	// SecretKey and PreviousSecretKey seal integration credentials (ADR 008): 32 raw bytes,
	// empty when unset. Without SecretKey integrations are unavailable.
	SecretKey, PreviousSecretKey string
	// WebDevPort, when set, redirects pages to the Vite server on that port of the same host,
	// for development (ADR 028); zero serves the embedded application.
	WebDevPort int
	// AggregatorURLs and FeedURLs hold EQUORI_AGGREGATOR_<ID>_URL and EQUORI_FEED_<ID>_URL by ID;
	// nil when none is set.
	AggregatorURLs, FeedURLs map[string]string
}

// Removed is an environment variable that ADR 029 replaced with a screen (BK26).
type Removed struct {
	Name, Screen string
}

// Managed reports whether equori runs its own PostgreSQL server (M1).
func (c Config) Managed() bool { return c.DatabaseURL == "" }

// Families lists the IDs that expand AggregatorURLFamily and FeedURLFamily.
type Families struct {
	Aggregators, Feeds []string
}

// Load reads every binary entry of Variables and reports every invalid one in one error (A161.1).
func Load(getenv func(string) string, families Families) (Config, error) {
	var (
		cfg   Config
		lines []string
	)

	for _, v := range Variables() {
		if v.Reader != Binary {
			continue
		}

		for _, n := range v.expand(families) {
			value := getenv(n.name)
			if value == "" {
				continue
			}

			if !v.valid(value) {
				lines = append(lines, v.report(n.name, value))

				continue
			}

			cfg.store(v, n, value)
		}
	}

	if cfg.HTTPAddr == "" {
		cfg.HTTPAddr = ":8080"
	}

	if cfg.PreviousSecretKey != "" && getenv("EQUORI_SECRET_KEY") == "" {
		lines = append(lines, "EQUORI_SECRET_KEY_PREVIOUS is set without EQUORI_SECRET_KEY")
	}

	if cfg.DatabaseURL == "" {
		cfg.DataDir = DataDir(getenv)

		switch {
		case cfg.DataDir != "":
			if cfg.BackupDir == "" {
				cfg.BackupDir = filepath.Join(cfg.DataDir, "backups")
			}
		case getenv("EQUORI_DATABASE_URL") == "":
			lines = append(lines, "EQUORI_DATABASE_URL is not set and this system has no default data directory; set EQUORI_DATABASE_URL or EQUORI_DATA_DIR")
		}
	}

	if len(lines) > 0 {
		return Config{}, errors.New(strings.Join(append([]string{reportHeader}, lines...), "\n"))
	}

	return cfg, nil
}

// Lookup returns the entry that name matches: an exact name, or a family whose prefix and
// suffix enclose a non-empty ID.
func Lookup(name string) (Variable, bool) {
	for _, v := range Variables() {
		prefix, suffix, family := strings.Cut(v.Name, idPlaceholder)
		if !family {
			if v.Name == name {
				return v, true
			}

			continue
		}

		if len(name) > len(prefix)+len(suffix) && strings.HasPrefix(name, prefix) && strings.HasSuffix(name, suffix) {
			return v, true
		}
	}

	return Variable{}, false
}

// Known reports whether name is an entry, a family member or a removed variable (A161.4).
func Known(name string) bool {
	if _, ok := Lookup(name); ok {
		return true
	}

	return slices.ContainsFunc(removedVariables(), func(r Removed) bool { return r.Name == name })
}

// DataDir is EQUORI_DATA_DIR, else DefaultDataDir of this system.
func DataDir(getenv func(string) string) string {
	return cmp.Or(getenv("EQUORI_DATA_DIR"), DefaultDataDir(runtime.GOOS, getenv))
}

// EnvFilePath is equori.env of the data directory; "" in external mode or without a data directory.
func EnvFilePath(getenv func(string) string) string {
	if getenv("EQUORI_DATABASE_URL") != "" {
		return ""
	}

	dir := DataDir(getenv)
	if dir == "" {
		return ""
	}

	return filepath.Join(dir, "equori.env")
}

// RemovedVariables returns the removed variables getenv still sets, in the order of the table.
func RemovedVariables(getenv func(string) string) []Removed {
	var out []Removed
	for _, r := range removedVariables() {
		if getenv(r.Name) != "" {
			out = append(out, r)
		}
	}

	return out
}

func removedVariables() []Removed {
	return []Removed{
		{"EQUORI_TIMEZONE", "Settings > Finances > Time zone"},
		{"EQUORI_SYNC_INTERVAL", "Settings > Integrations > Check for new data"},
		{"EQUORI_GEMINI_API_KEY", "Settings > Assistant > Providers, preset aistudio"},
		{"EQUORI_GEMINI_URL", "Settings > Assistant > Providers, preset aistudio"},
		{"EQUORI_PRICE_FEEDS", "Settings > Market data"},
		{"EQUORI_INDEX_FEEDS", "Settings > Market data"},
	}
}

// named is one environment name of an entry; id is set for a family member.
type named struct {
	name, id string
}

func (v Variable) expand(families Families) []named {
	prefix, suffix, family := strings.Cut(v.Name, idPlaceholder)
	if !family {
		return []named{{name: v.Name}}
	}

	ids := families.Feeds
	if v.Name == AggregatorURLFamily {
		ids = families.Aggregators
	}

	out := make([]named, 0, len(ids))
	for _, id := range ids {
		out = append(out, named{name: prefix + strings.ToUpper(id) + suffix, id: id})
	}

	return out
}

func (v Variable) report(name, value string) string {
	if v.Secret {
		return fmt.Sprintf("%s is set but invalid; expected %s; example: %s=%s", name, v.Expected, name, v.Example)
	}

	return fmt.Sprintf("%s is %q; expected %s; example: %s=%s", name, value, v.Expected, name, v.Example)
}

// store copies a valid value into its field; valid has already checked its form.
func (c *Config) store(v Variable, n named, value string) {
	switch v.Name {
	case AggregatorURLFamily:
		c.AggregatorURLs = setURL(c.AggregatorURLs, n.id, value)
	case FeedURLFamily:
		c.FeedURLs = setURL(c.FeedURLs, n.id, value)
	case "EQUORI_DATABASE_URL":
		c.DatabaseURL = value
	case "EQUORI_HTTP_ADDR":
		c.HTTPAddr = value
	case "EQUORI_LOG_LEVEL":
		_ = c.LogLevel.UnmarshalText([]byte(value))
	case "EQUORI_INSECURE_COOKIES":
		c.InsecureCookies, _ = strconv.ParseBool(value)
	case "EQUORI_DISTRIBUTION":
		c.Distribution = value
	case "EQUORI_API_DOCS":
		c.APIDocs, _ = strconv.ParseBool(value)
	case "EQUORI_SECRET_KEY":
		key, _ := base64.StdEncoding.DecodeString(value)
		c.SecretKey = string(key)
	case "EQUORI_SECRET_KEY_PREVIOUS":
		key, _ := base64.StdEncoding.DecodeString(value)
		c.PreviousSecretKey = string(key)
	case "EQUORI_WEB_DEV_PORT":
		c.WebDevPort, _ = strconv.Atoi(value)
	case "EQUORI_POSTGRES_BIN":
		c.PostgresBin = value
	case "EQUORI_BACKUP_DIR":
		c.BackupDir = value
	case "EQUORI_COPY_DIR":
		c.CopyDir = value
	}
}

func setURL(urls map[string]string, id, value string) map[string]string {
	if urls == nil {
		urls = make(map[string]string)
	}

	urls[id] = value

	return urls
}
