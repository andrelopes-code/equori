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
	// APIDocs serves the API reference at /docs and the contract at /openapi.yaml without a session.
	APIDocs bool
	// SecretKey and PreviousSecretKey seal integration credentials (ADR 008): 32 raw bytes,
	// empty when unset. Without SecretKey integrations are unavailable.
	SecretKey, PreviousSecretKey string
	// WebDevPort, when set, redirects pages to the Vite server on that port of the same host,
	// for development (ADR 028); zero serves the embedded application.
	WebDevPort int
}

// Removed is an environment variable that ADR 029 replaced with a screen (BK26).
type Removed struct {
	Name, Screen string
}

// Managed reports whether equori runs its own PostgreSQL server (M1).
func (c Config) Managed() bool { return c.DatabaseURL == "" }

func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		DatabaseURL: getenv("EQUORI_DATABASE_URL"),
		HTTPAddr:    getenv("EQUORI_HTTP_ADDR"),
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
	cfg.CopyDir = getenv("EQUORI_COPY_DIR")

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

// RemovedVariables returns the removed variables getenv still sets, in the order of the table.
func RemovedVariables(getenv func(string) string) []Removed {
	var out []Removed
	for _, r := range []Removed{
		{"EQUORI_TIMEZONE", "Settings > Finances > Time zone"},
		{"EQUORI_SYNC_INTERVAL", "Settings > Integrations > Check for new data"},
		{"EQUORI_GEMINI_API_KEY", "Settings > Assistant > Providers, preset aistudio"},
		{"EQUORI_GEMINI_URL", "Settings > Assistant > Providers, preset aistudio"},
		{"EQUORI_PRICE_FEEDS", "Settings > Market data"},
		{"EQUORI_INDEX_FEEDS", "Settings > Market data"},
	} {
		if getenv(r.Name) != "" {
			out = append(out, r)
		}
	}

	return out
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
