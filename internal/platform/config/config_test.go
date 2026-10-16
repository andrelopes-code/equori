package config

import (
	"log/slog"
	"testing"
	"time"
)

func TestLoad(t *testing.T) {
	tests := []struct {
		name    string
		env     map[string]string
		want    Config
		wantErr bool
	}{
		{
			name: "defaults",
			env:  map[string]string{"EQUORI_DATABASE_URL": "postgres://x"},
			want: Config{
				DatabaseURL: "postgres://x", HTTPAddr: ":8080", LogLevel: slog.LevelInfo, TimeZone: time.UTC, PluggyURL: "https://api.pluggy.ai",
				SyncInterval: time.Hour, GeminiURL: "https://generativelanguage.googleapis.com",
			},
		},
		{
			name: "explicit values",
			env: map[string]string{
				"EQUORI_DATABASE_URL":     "postgres://x",
				"EQUORI_HTTP_ADDR":        "127.0.0.1:9000",
				"EQUORI_LOG_LEVEL":        "debug",
				"EQUORI_INSECURE_COOKIES": "true",
				"EQUORI_TIMEZONE":         "UTC",
				"EQUORI_API_DOCS":         "true",
				"EQUORI_PLUGGY_URL":       "http://127.0.0.1:9100",
				"EQUORI_SYNC_INTERVAL":    "15m",
				"EQUORI_GEMINI_API_KEY":   "k",
				"EQUORI_GEMINI_URL":       "http://127.0.0.1:9200",
			},
			want: Config{
				DatabaseURL: "postgres://x", HTTPAddr: "127.0.0.1:9000", LogLevel: slog.LevelDebug,
				TimeZone: time.UTC, InsecureCookies: true, APIDocs: true, PluggyURL: "http://127.0.0.1:9100",
				SyncInterval: 15 * time.Minute, GeminiAPIKey: "k", GeminiURL: "http://127.0.0.1:9200",
			},
		},
		{name: "missing database url", env: map[string]string{}, wantErr: true},
		{
			name:    "invalid insecure cookies",
			env:     map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_INSECURE_COOKIES": "maybe"},
			wantErr: true,
		},
		{
			name:    "invalid api docs",
			env:     map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_API_DOCS": "maybe"},
			wantErr: true,
		},
		{
			name:    "invalid sync interval",
			env:     map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_SYNC_INTERVAL": "soon"},
			wantErr: true,
		},
		{
			name:    "sync interval under a minute",
			env:     map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_SYNC_INTERVAL": "30s"},
			wantErr: true,
		},
		{
			name:    "unknown time zone",
			env:     map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_TIMEZONE": "Mars/Olympus"},
			wantErr: true,
		},
		{
			name:    "invalid log level",
			env:     map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_LOG_LEVEL": "verbose"},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Load(func(k string) string { return tt.env[k] })
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Fatalf("got %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestLoadNamedTimeZone(t *testing.T) {
	cfg, err := Load(func(k string) string {
		return map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_TIMEZONE": "America/Sao_Paulo"}[k]
	})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.TimeZone.String() != "America/Sao_Paulo" {
		t.Fatalf("TimeZone = %s", cfg.TimeZone)
	}
}

// ADR 008: integration keys are 32 bytes of standard base64.
func TestLoadSecretKeys(t *testing.T) {
	current := "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="
	previous := "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI="
	base := func(kv ...string) func(string) string {
		env := map[string]string{"EQUORI_DATABASE_URL": "postgres://x"}
		for i := 0; i < len(kv); i += 2 {
			env[kv[i]] = kv[i+1]
		}
		return func(k string) string { return env[k] }
	}
	got, err := Load(base("EQUORI_SECRET_KEY", current, "EQUORI_SECRET_KEY_PREVIOUS", previous))
	if err != nil || len(got.SecretKey) != 32 || got.SecretKey[0] != 1 || len(got.PreviousSecretKey) != 32 || got.PreviousSecretKey[0] != 2 {
		t.Fatalf("keys = %x, %x, %v", got.SecretKey, got.PreviousSecretKey, err)
	}
	if got, err := Load(base()); err != nil || got.SecretKey != "" {
		t.Fatalf("without keys = %+v, %v", got, err)
	}
	for name, getenv := range map[string]func(string) string{
		"short key":                base("EQUORI_SECRET_KEY", "AQEB"),
		"not base64":               base("EQUORI_SECRET_KEY", "not base64!"),
		"previous without current": base("EQUORI_SECRET_KEY_PREVIOUS", previous),
	} {
		if _, err := Load(getenv); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}
