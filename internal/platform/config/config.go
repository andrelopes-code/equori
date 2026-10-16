// Package config loads process configuration from environment variables.
package config

import (
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
}

func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		DatabaseURL: getenv("EQUORI_DATABASE_URL"),
		HTTPAddr:    getenv("EQUORI_HTTP_ADDR"),
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
	return cfg, nil
}
