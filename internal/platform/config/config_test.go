package config

import (
	"log/slog"
	"testing"
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
			want: Config{DatabaseURL: "postgres://x", HTTPAddr: ":8080", LogLevel: slog.LevelInfo},
		},
		{
			name: "explicit values",
			env: map[string]string{
				"EQUORI_DATABASE_URL":     "postgres://x",
				"EQUORI_HTTP_ADDR":        "127.0.0.1:9000",
				"EQUORI_LOG_LEVEL":        "debug",
				"EQUORI_INSECURE_COOKIES": "true",
			},
			want: Config{DatabaseURL: "postgres://x", HTTPAddr: "127.0.0.1:9000", LogLevel: slog.LevelDebug, InsecureCookies: true},
		},
		{name: "missing database url", env: map[string]string{}, wantErr: true},
		{
			name:    "invalid insecure cookies",
			env:     map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_INSECURE_COOKIES": "maybe"},
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
