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
			want: Config{DatabaseURL: "postgres://x", HTTPAddr: ":8080", LogLevel: slog.LevelInfo, TimeZone: time.UTC},
		},
		{
			name: "explicit values",
			env: map[string]string{
				"EQUORI_DATABASE_URL":     "postgres://x",
				"EQUORI_HTTP_ADDR":        "127.0.0.1:9000",
				"EQUORI_LOG_LEVEL":        "debug",
				"EQUORI_INSECURE_COOKIES": "true",
				"EQUORI_TIMEZONE":         "UTC",
			},
			want: Config{
				DatabaseURL: "postgres://x", HTTPAddr: "127.0.0.1:9000", LogLevel: slog.LevelDebug,
				TimeZone: time.UTC, InsecureCookies: true,
			},
		},
		{name: "missing database url", env: map[string]string{}, wantErr: true},
		{
			name:    "invalid insecure cookies",
			env:     map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_INSECURE_COOKIES": "maybe"},
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
