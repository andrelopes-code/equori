package config

import (
	"log/slog"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestLoad(t *testing.T) {
	t.Parallel()

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
				DatabaseURL: "postgres://x", HTTPAddr: ":8080", LogLevel: slog.LevelInfo,
			},
		},
		{
			name: "explicit values",
			env: map[string]string{
				"EQUORI_DATABASE_URL":     "postgres://x",
				"EQUORI_HTTP_ADDR":        "127.0.0.1:9000",
				"EQUORI_LOG_LEVEL":        "debug",
				"EQUORI_INSECURE_COOKIES": "true",
				"EQUORI_API_DOCS":         "true",
				"EQUORI_WEB_DEV_PORT":     "5173",
			},
			want: Config{
				DatabaseURL: "postgres://x", HTTPAddr: "127.0.0.1:9000", LogLevel: slog.LevelDebug,
				InsecureCookies: true, APIDocs: true, WebDevPort: 5173,
			},
		},
		{
			name:    "invalid web dev port",
			env:     map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_WEB_DEV_PORT": "vite"},
			wantErr: true,
		},
		{
			name:    "web dev port out of range",
			env:     map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_WEB_DEV_PORT": "70000"},
			wantErr: true,
		},
		{name: "missing database url and data directory", env: map[string]string{}, wantErr: true},
		{
			name: "managed with explicit directories",
			env:  map[string]string{"EQUORI_DATA_DIR": "/srv/equori", "EQUORI_POSTGRES_BIN": "/usr/lib/postgresql/18/bin"},
			want: Config{
				DataDir: "/srv/equori", BackupDir: filepath.Join("/srv/equori", "backups"), PostgresBin: "/usr/lib/postgresql/18/bin",
				HTTPAddr: ":8080", LogLevel: slog.LevelInfo,
			},
		},
		{
			name: "managed with a backup directory",
			env:  map[string]string{"EQUORI_DATA_DIR": "/srv/equori", "EQUORI_BACKUP_DIR": "/mnt/backups"},
			want: Config{
				DataDir: "/srv/equori", BackupDir: "/mnt/backups",
				HTTPAddr: ":8080", LogLevel: slog.LevelInfo,
			},
		},
		{
			name: "copy directory",
			env:  map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_COPY_DIR": "/copies"},
			want: Config{
				DatabaseURL: "postgres://x", CopyDir: "/copies",
				HTTPAddr: ":8080", LogLevel: slog.LevelInfo,
			},
		},
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
			name:    "invalid log level",
			env:     map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_LOG_LEVEL": "verbose"},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Load(func(k string) string { return tt.env[k] }, Families{})
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tt.wantErr)
			}

			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("got %+v, want %+v", got, tt.want)
			}
		})
	}
}

// ADR 008: integration keys are 32 bytes of standard base64.
func TestLoadSecretKeys(t *testing.T) {
	t.Parallel()

	current := "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="
	previous := "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI="
	base := func(kv ...string) func(string) string {
		env := map[string]string{"EQUORI_DATABASE_URL": "postgres://x"}
		for i := 0; i < len(kv); i += 2 {
			env[kv[i]] = kv[i+1]
		}

		return func(k string) string { return env[k] }
	}

	got, err := Load(base("EQUORI_SECRET_KEY", current, "EQUORI_SECRET_KEY_PREVIOUS", previous), Families{})
	if err != nil || len(got.SecretKey) != 32 || got.SecretKey[0] != 1 || len(got.PreviousSecretKey) != 32 || got.PreviousSecretKey[0] != 2 {
		t.Fatalf("keys = %x, %x, %v", got.SecretKey, got.PreviousSecretKey, err)
	}

	if got, err := Load(base(), Families{}); err != nil || got.SecretKey != "" {
		t.Fatalf("without keys = %+v, %v", got, err)
	}

	for name, getenv := range map[string]func(string) string{
		"short key":                base("EQUORI_SECRET_KEY", "AQEB"),
		"not base64":               base("EQUORI_SECRET_KEY", "not base64!"),
		"previous without current": base("EQUORI_SECRET_KEY_PREVIOUS", previous),
	} {
		if _, err := Load(getenv, Families{}); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestRemovedVariables(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		env  map[string]string
		want []Removed
	}{
		{name: "none", env: map[string]string{"EQUORI_DATABASE_URL": "postgres://x"}},
		{
			name: "two",
			env:  map[string]string{"EQUORI_TIMEZONE": "UTC", "EQUORI_PRICE_FEEDS": "ecb"},
			want: []Removed{
				{"EQUORI_TIMEZONE", "Settings > Finances > Time zone"},
				{"EQUORI_PRICE_FEEDS", "Settings > Market data"},
			},
		},
		{
			name: "all",
			env: map[string]string{
				"EQUORI_TIMEZONE": "x", "EQUORI_SYNC_INTERVAL": "x", "EQUORI_GEMINI_API_KEY": "x",
				"EQUORI_GEMINI_URL": "x", "EQUORI_PRICE_FEEDS": "x", "EQUORI_INDEX_FEEDS": "x",
			},
			want: []Removed{
				{"EQUORI_TIMEZONE", "Settings > Finances > Time zone"},
				{"EQUORI_SYNC_INTERVAL", "Settings > Integrations > Check for new data"},
				{"EQUORI_GEMINI_API_KEY", "Settings > Assistant > Providers, preset aistudio"},
				{"EQUORI_GEMINI_URL", "Settings > Assistant > Providers, preset aistudio"},
				{"EQUORI_PRICE_FEEDS", "Settings > Market data"},
				{"EQUORI_INDEX_FEEDS", "Settings > Market data"},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := RemovedVariables(func(k string) string { return tt.env[k] })
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("got %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestS222S223Report(t *testing.T) {
	t.Parallel()

	const (
		header      = "invalid configuration (docs/install/configuration.md):"
		secretKeyEx = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
	)

	tests := []struct {
		name    string
		env     map[string]string
		want    string
		notWant string
	}{
		{
			name: "S222",
			env:  map[string]string{"EQUORI_LOG_LEVEL": "verbose", "EQUORI_SECRET_KEY": "abc"},
			want: header + "\n" +
				"EQUORI_SECRET_KEY is set but invalid; expected 32 bytes in standard base64; example: EQUORI_SECRET_KEY=" + secretKeyEx + "\n" +
				`EQUORI_LOG_LEVEL is "verbose"; expected debug, info, warn or error; example: EQUORI_LOG_LEVEL=debug`,
			notWant: "abc",
		},
		{
			name: "S223",
			env: map[string]string{
				"EQUORI_HTTP_ADDR":             "localhost",
				"EQUORI_AGGREGATOR_PLUGGY_URL": "ftp://a",
			},
			want: header + "\n" +
				`EQUORI_HTTP_ADDR is "localhost"; expected host:port with a port from 1 to 65535; example: EQUORI_HTTP_ADDR=127.0.0.1:8081` + "\n" +
				`EQUORI_AGGREGATOR_PLUGGY_URL is "ftp://a"; expected an http:// or https:// URL; example: EQUORI_AGGREGATOR_PLUGGY_URL=https://aggregator.example`,
		},
		{
			name: "secret and cross line",
			env: map[string]string{
				"EQUORI_DATABASE_URL":        "mysql://x",
				"EQUORI_SECRET_KEY_PREVIOUS": secretKeyEx,
			},
			want: header + "\n" +
				"EQUORI_DATABASE_URL is set but invalid; expected a postgres:// or postgresql:// URL; example: EQUORI_DATABASE_URL=postgres://equori:password@db:5432/equori?sslmode=disable" + "\n" +
				"EQUORI_SECRET_KEY_PREVIOUS is set without EQUORI_SECRET_KEY",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			env := map[string]string{"EQUORI_DATABASE_URL": "postgres://x"}
			for k, v := range tt.env {
				env[k] = v
			}

			_, err := Load(func(k string) string { return env[k] }, Families{Aggregators: []string{"pluggy"}})
			if err == nil {
				t.Fatal("err = nil")
			}

			if err.Error() != tt.want {
				t.Fatalf("err = %q, want %q", err.Error(), tt.want)
			}

			if tt.notWant != "" && strings.Contains(err.Error(), tt.notWant) {
				t.Fatalf("err %q holds %q", err.Error(), tt.notWant)
			}
		})
	}
}

func TestLoadFamilies(t *testing.T) {
	t.Parallel()

	env := map[string]string{
		"EQUORI_DATABASE_URL":          "postgres://x",
		"EQUORI_AGGREGATOR_PLUGGY_URL": "http://127.0.0.1:9",
		"EQUORI_FEED_BCB_PTAX_URL":     "https://feed.example",
	}
	getenv := func(k string) string { return env[k] }

	got, err := Load(getenv, Families{Aggregators: []string{"pluggy"}, Feeds: []string{"bcb_ptax"}})
	if err != nil {
		t.Fatalf("err = %v", err)
	}

	if want := map[string]string{"pluggy": "http://127.0.0.1:9"}; !reflect.DeepEqual(got.AggregatorURLs, want) {
		t.Fatalf("AggregatorURLs = %v, want %v", got.AggregatorURLs, want)
	}

	if want := map[string]string{"bcb_ptax": "https://feed.example"}; !reflect.DeepEqual(got.FeedURLs, want) {
		t.Fatalf("FeedURLs = %v, want %v", got.FeedURLs, want)
	}

	got, err = Load(func(k string) string { return map[string]string{"EQUORI_DATABASE_URL": "postgres://x"}[k] },
		Families{Aggregators: []string{"pluggy"}, Feeds: []string{"bcb_ptax"}})
	if err != nil || got.AggregatorURLs != nil || got.FeedURLs != nil {
		t.Fatalf("without family variables = %+v, %v", got, err)
	}
}

func TestKnown(t *testing.T) {
	t.Parallel()

	tests := map[string]bool{
		"EQUORI_LOG_LEVEL":             true,
		"EQUORI_AGGREGATOR_PLUGGY_URL": true,
		"EQUORI_AGGREGATOR__URL":       false,
		"EQUORI_FEED_BCB_PTAX_URL":     true,
		"EQUORI_TIMEZONE":              true,
		"EQUORI_TEST_DATABASE_URL":     true,
		"POSTGRES_PASSWORD":            true,
		"EQUORI_LOG_LEVL":              false,
		"EQUORI_TEST_HELPER":           false,
	}
	for name, want := range tests {
		if got := Known(name); got != want {
			t.Errorf("Known(%q) = %v, want %v", name, got, want)
		}
	}
}

func TestEnvFilePath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		env  map[string]string
		want string
	}{
		{
			name: "external mode",
			env:  map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_DATA_DIR": "/d"},
			want: "",
		},
		{
			name: "managed mode",
			env:  map[string]string{"EQUORI_DATA_DIR": "/d"},
			want: filepath.Join("/d", "equori.env"),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := EnvFilePath(func(k string) string { return tt.env[k] }); got != tt.want {
				t.Fatalf("EnvFilePath = %q, want %q", got, tt.want)
			}
		})
	}
}
