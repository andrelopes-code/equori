// Package config loads process configuration from environment variables.
package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	DatabaseURL string
	// DataDir, PostgresBin and BackupDir serve managed mode (ADR 022, M1 to M3); DataDir is empty
	// in external mode.
	DataDir, PostgresBin, BackupDir string
	HTTPAddr                        string
	LogLevel                        slog.Level
	// TimeZone defines "today" and month boundaries for accounting dates (ADR 005).
	TimeZone *time.Location
	// InsecureCookies drops the Secure cookie attribute for plain-HTTP LAN deployments (ADR 003).
	InsecureCookies bool
	// APIDocs serves the API reference at /docs and the contract at /openapi.yaml without a session.
	APIDocs bool
	// SecretKey and PreviousSecretKey seal integration credentials (ADR 008): 32 raw bytes,
	// empty when unset. Without SecretKey integrations are unavailable.
	SecretKey, PreviousSecretKey string
	// SyncInterval is how often the scheduler checks connections for new data (P6 A43).
	SyncInterval time.Duration
	// WebDevPort, when set, redirects pages to the Vite server on that port of the same host,
	// for development (ADR 008); zero serves the embedded application.
	WebDevPort int
	// GeminiAPIKey enables the Gemini API provider (ADR 009); empty leaves it unregistered.
	GeminiAPIKey string
	// GeminiURL is the base URL of the Gemini API, the only address Gemini requests go to (N17).
	GeminiURL string
	// PriceFeeds are the identifiers listed in EQUORI_PRICE_FEEDS; the marketdata module validates them.
	PriceFeeds []string
	// IndexFeeds are the identifiers listed in EQUORI_INDEX_FEEDS; the marketdata module validates them.
	IndexFeeds []string
}

// Managed reports whether equori runs its own PostgreSQL server (M1).
func (c Config) Managed() bool { return c.DatabaseURL == "" }

func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		DatabaseURL:  getenv("EQUORI_DATABASE_URL"),
		HTTPAddr:     getenv("EQUORI_HTTP_ADDR"),
		GeminiAPIKey: getenv("EQUORI_GEMINI_API_KEY"),
		GeminiURL:    getenv("EQUORI_GEMINI_URL"),
	}
	for name := range strings.SplitSeq(getenv("EQUORI_PRICE_FEEDS"), ",") {
		if name = strings.TrimSpace(name); name != "" {
			cfg.PriceFeeds = append(cfg.PriceFeeds, name)
		}
	}
	for name := range strings.SplitSeq(getenv("EQUORI_INDEX_FEEDS"), ",") {
		if name = strings.TrimSpace(name); name != "" {
			cfg.IndexFeeds = append(cfg.IndexFeeds, name)
		}
	}
	if cfg.GeminiURL == "" {
		cfg.GeminiURL = "https://generativelanguage.googleapis.com"
	}
	cfg.SyncInterval = time.Hour
	if v := getenv("EQUORI_SYNC_INTERVAL"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return Config{}, fmt.Errorf("EQUORI_SYNC_INTERVAL: %w", err)
		}
		// Pluggy allows 360 requests per minute; a sync of one account takes several.
		if d < time.Minute {
			return Config{}, errors.New("EQUORI_SYNC_INTERVAL must be at least 1m")
		}
		cfg.SyncInterval = d
	}
	if v := getenv("EQUORI_WEB_DEV_PORT"); v != "" {
		port, err := strconv.Atoi(v)
		if err != nil || port < 1 || port > 65535 {
			return Config{}, fmt.Errorf("EQUORI_WEB_DEV_PORT: %q is not a port", v)
		}
		cfg.WebDevPort = port
	}
	cfg.PostgresBin = getenv("EQUORI_POSTGRES_BIN")
	cfg.BackupDir = getenv("EQUORI_BACKUP_DIR")
	if cfg.DatabaseURL == "" {
		cfg.DataDir = getenv("EQUORI_DATA_DIR")
		if cfg.DataDir == "" {
			cfg.DataDir = DefaultDataDir(runtime.GOOS, getenv)
		}
		if cfg.DataDir == "" {
			return Config{}, errors.New("EQUORI_DATABASE_URL is not set and this system has no default data directory; set EQUORI_DATABASE_URL or EQUORI_DATA_DIR")
		}
		if cfg.BackupDir == "" {
			cfg.BackupDir = filepath.Join(cfg.DataDir, "backups")
		}
	}
	if cfg.HTTPAddr == "" {
		cfg.HTTPAddr = ":8080"
	}
	if lvl := getenv("EQUORI_LOG_LEVEL"); lvl != "" {
		if err := cfg.LogLevel.UnmarshalText([]byte(lvl)); err != nil {
			return Config{}, fmt.Errorf("EQUORI_LOG_LEVEL: %w", err)
		}
	}
	// The host's zone: a container without TZ and without zone files resolves to UTC.
	cfg.TimeZone = time.Local
	if name := getenv("EQUORI_TIMEZONE"); name != "" {
		tz, err := time.LoadLocation(name)
		if err != nil {
			return Config{}, fmt.Errorf("EQUORI_TIMEZONE: %w", err)
		}
		cfg.TimeZone = tz
	}
	if v := getenv("EQUORI_INSECURE_COOKIES"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return Config{}, fmt.Errorf("EQUORI_INSECURE_COOKIES: %w", err)
		}
		cfg.InsecureCookies = b
	}
	if v := getenv("EQUORI_API_DOCS"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return Config{}, fmt.Errorf("EQUORI_API_DOCS: %w", err)
		}
		cfg.APIDocs = b
	}
	var err error
	if cfg.SecretKey, err = secretKey(getenv, "EQUORI_SECRET_KEY"); err != nil {
		return Config{}, err
	}
	if cfg.PreviousSecretKey, err = secretKey(getenv, "EQUORI_SECRET_KEY_PREVIOUS"); err != nil {
		return Config{}, err
	}
	if cfg.PreviousSecretKey != "" && cfg.SecretKey == "" {
		return Config{}, errors.New("EQUORI_SECRET_KEY_PREVIOUS is set without EQUORI_SECRET_KEY")
	}
	return cfg, nil
}

func secretKey(getenv func(string) string, name string) (string, error) {
	v := getenv(name)
	if v == "" {
		return "", nil
	}
	k, err := base64.StdEncoding.DecodeString(v)
	if err != nil || len(k) != 32 {
		return "", fmt.Errorf("%s must be 32 bytes in standard base64", name)
	}
	return string(k), nil
}
