// Package config loads process configuration from environment variables.
package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
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
	// SyncInterval is how often the scheduler checks connections for new data (P6 A43).
	SyncInterval time.Duration
	// GeminiAPIKey enables the Gemini API provider (ADR 009); empty leaves it unregistered.
	GeminiAPIKey string
	// GeminiURL is the base URL of the Gemini API, the only address Gemini requests go to (N17).
	GeminiURL string
	// PTAXFeed and COTAHISTFeed enable the price feeds named in EQUORI_PRICE_FEEDS (P8 A62);
	// PTAXURL and COTAHISTURL are the only addresses their requests go to (N17).
	PTAXFeed, COTAHISTFeed bool
	PTAXURL, COTAHISTURL   string
}

func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		DatabaseURL:  getenv("EQUORI_DATABASE_URL"),
		HTTPAddr:     getenv("EQUORI_HTTP_ADDR"),
		PluggyURL:    getenv("EQUORI_PLUGGY_URL"),
		GeminiAPIKey: getenv("EQUORI_GEMINI_API_KEY"),
		GeminiURL:    getenv("EQUORI_GEMINI_URL"),
		PTAXURL:      getenv("EQUORI_BCB_PTAX_URL"),
		COTAHISTURL:  getenv("EQUORI_B3_COTAHIST_URL"),
	}
	if cfg.PTAXURL == "" {
		cfg.PTAXURL = "https://olinda.bcb.gov.br/olinda/service/PTAX/version/v1/odata"
	}
	if cfg.COTAHISTURL == "" {
		cfg.COTAHISTURL = "https://bvmf.bmfbovespa.com.br/InstDados/SerHist"
	}
	for name := range strings.SplitSeq(getenv("EQUORI_PRICE_FEEDS"), ",") {
		switch strings.TrimSpace(name) {
		case "":
		case "bcb_ptax":
			cfg.PTAXFeed = true
		case "b3_cotahist":
			cfg.COTAHISTFeed = true
		default:
			return Config{}, fmt.Errorf("EQUORI_PRICE_FEEDS: unknown feed %q", name)
		}
	}
	if cfg.PluggyURL == "" {
		cfg.PluggyURL = "https://api.pluggy.ai"
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
