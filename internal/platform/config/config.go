// Package config loads process configuration from environment variables.
package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"time"
)

type Config struct {
	DatabaseURL string
	HTTPAddr    string
	LogLevel    slog.Level
	// TimeZone defines "today" and month boundaries for accounting dates (ADR 005).
	TimeZone *time.Location
	// InsecureCookies drops the Secure cookie attribute for plain-HTTP LAN deployments (ADR 003).
	InsecureCookies bool
	// APIDocs serves the API reference at /docs and the contract at /openapi.yaml without a session.
	APIDocs bool
	// SecretKey and PreviousSecretKey seal integration credentials (ADR 008): 32 raw bytes,
	// empty when unset. Without SecretKey integrations are unavailable.
	SecretKey, PreviousSecretKey string
	// PluggyURL is the base URL of the Pluggy API, the only address Pluggy requests go to (N17).
	PluggyURL string
}

func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		DatabaseURL: getenv("EQUORI_DATABASE_URL"),
		HTTPAddr:    getenv("EQUORI_HTTP_ADDR"),
		PluggyURL:   getenv("EQUORI_PLUGGY_URL"),
	}
	if cfg.PluggyURL == "" {
		cfg.PluggyURL = "https://api.pluggy.ai"
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("EQUORI_DATABASE_URL is not set")
	}
	if cfg.HTTPAddr == "" {
		cfg.HTTPAddr = ":8080"
	}
	if lvl := getenv("EQUORI_LOG_LEVEL"); lvl != "" {
		if err := cfg.LogLevel.UnmarshalText([]byte(lvl)); err != nil {
			return Config{}, fmt.Errorf("EQUORI_LOG_LEVEL: %w", err)
		}
	}
	tz, err := time.LoadLocation(getenv("EQUORI_TIMEZONE"))
	if err != nil {
		return Config{}, fmt.Errorf("EQUORI_TIMEZONE: %w", err)
	}
	cfg.TimeZone = tz
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
