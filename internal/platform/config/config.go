// Package config loads process configuration from environment variables.
package config

import (
	"encoding/base64"
	"errors"
	"log/slog"
	"path/filepath"
	"runtime"
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
	// LogFormat is "json" or "text".
	LogFormat string
	// InsecureCookies drops the Secure cookie attribute whatever the scheme of the page (ADR 003).
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

// Managed reports whether equori runs its own PostgreSQL server (M1).
func (c Config) Managed() bool { return c.DatabaseURL == "" }

// Families lists the IDs that expand AggregatorURLFamily and FeedURLFamily.
type Families struct {
	Aggregators, Feeds []string
}

// Load reads every binary entry of Variables and reports every invalid one in one error (A161.1).
func Load(getenv func(string) string, families Families) (Config, error) {
	cfg, lines := loadVariables(getenv, families)

	if cfg.HTTPAddr == "" {
		cfg.HTTPAddr = defaultHTTPAddr(runtime.GOOS)
	}

	lines = append(lines, checkSecretKeys(cfg, getenv)...)
	lines = append(lines, resolveDataDir(&cfg, getenv)...)

	if len(lines) > 0 {
		return Config{}, errors.New(strings.Join(append([]string{reportHeader}, lines...), "\n"))
	}

	return cfg, nil
}

func loadVariables(getenv func(string) string, families Families) (Config, []string) {
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

	return cfg, lines
}

func checkSecretKeys(cfg Config, getenv func(string) string) []string {
	if cfg.PreviousSecretKey != "" && getenv("EQUORI_SECRET_KEY") == "" {
		return []string{"EQUORI_SECRET_KEY_PREVIOUS is set without EQUORI_SECRET_KEY"}
	}

	return nil
}

func resolveDataDir(cfg *Config, getenv func(string) string) []string {
	if cfg.DatabaseURL != "" {
		return nil
	}

	cfg.DataDir = DataDir(getenv)

	switch {
	case cfg.DataDir != "":
		if cfg.BackupDir == "" {
			cfg.BackupDir = filepath.Join(cfg.DataDir, "backups")
		}
	case getenv("EQUORI_DATABASE_URL") == "":
		return []string{
			"EQUORI_DATABASE_URL is not set and this system has no default data directory; set EQUORI_DATABASE_URL or EQUORI_DATA_DIR",
		}
	}

	return nil
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
	case "EQUORI_LOG_FORMAT":
		c.LogFormat = value
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

// defaultHTTPAddr keeps the first start on Windows on loopback, where no script writes equori.env
// (A10).
func defaultHTTPAddr(goos string) string {
	if goos == "windows" {
		return "127.0.0.1:8080"
	}

	return ":8080"
}
