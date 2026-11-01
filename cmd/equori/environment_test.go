package main

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"maps"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/config"
)

func TestEnvNames(t *testing.T) {
	t.Parallel()

	got := envNames(
		[]string{"EQUORI_A=1", "PATH=/bin", "EQUORI_B=x=y"},
		map[string]string{"EQUORI_A": "2", "EQUORI_C": "3"},
	)

	want := []string{"EQUORI_A", "EQUORI_B", "EQUORI_C"}
	if !slices.Equal(got, want) {
		t.Fatalf("envNames = %v, want %v", got, want)
	}
}

func TestEveryReadNameIsMapped(t *testing.T) {
	t.Parallel()

	var read []string

	record := func(name string) string {
		read = append(read, name)

		return ""
	}

	// An empty environment has no data directory, so Load returns an error; only the names read matter.
	_, _ = config.Load(record, families())

	for _, name := range read {
		if !strings.HasPrefix(name, envPrefix) {
			continue
		}

		v, ok := config.Lookup(name)
		if !ok || v.Reader != config.Binary {
			t.Errorf("%s: Lookup = %v, %v; want a %s entry", name, ok, v.Reader, config.Binary)
		}
	}

	for _, name := range []string{"EQUORI_AGGREGATOR_PLUGGY_URL", "EQUORI_FEED_BCB_PTAX_URL"} {
		if !slices.Contains(read, name) {
			t.Errorf("%s: not read", name)
		}
	}
}

func TestStartWarnings(t *testing.T) {
	t.Parallel()

	const noKey = "EQUORI_SECRET_KEY is not set: bank connections, the second factor and the copy password are unavailable"

	external := config.Config{DatabaseURL: "postgres://x", SecretKey: "k"}

	tests := []struct {
		name   string
		cfg    config.Config
		getenv map[string]string
		names  []string
		want   []map[string]any
	}{
		{
			name:  "S224",
			cfg:   external,
			names: []string{"EQUORI_DATABASE_URL", "EQUORI_LOG_LEVL"},
			want: []map[string]any{
				{"level": "WARN", "msg": "environment variable unknown", "variable": "EQUORI_LOG_LEVL"},
			},
		},
		{
			name: "external without key",
			cfg:  config.Config{DatabaseURL: "postgres://x"},
			want: []map[string]any{{"level": "WARN", "msg": noKey}},
		},
		{name: "managed without key", cfg: config.Config{DataDir: "/d"}},
		{
			name:   "removed",
			cfg:    external,
			getenv: map[string]string{"EQUORI_TIMEZONE": "x"},
			names:  []string{"EQUORI_TIMEZONE"},
			want: []map[string]any{{
				"level":       "WARN",
				"msg":         "environment variable removed",
				"variable":    "EQUORI_TIMEZONE",
				"replaced_by": "Settings > Finances > Time zone",
			}},
		},
		{
			name: "known names",
			cfg:  external,
			names: []string{
				"EQUORI_FEED_BCB_PTAX_URL",
				"EQUORI_TEST_DATABASE_URL",
				"EQUORI_TEST_DB_SERVICE",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var buf bytes.Buffer

			log := slog.New(slog.NewJSONHandler(&buf, nil))
			startWarnings(log, tt.cfg, func(k string) string { return tt.getenv[k] }, tt.names)

			var got []map[string]any

			for line := range bytes.SplitSeq(bytes.TrimSpace(buf.Bytes()), []byte("\n")) {
				if len(line) == 0 {
					continue
				}

				var rec map[string]any
				if err := json.Unmarshal(line, &rec); err != nil {
					t.Fatalf("decode %s: %v", line, err)
				}

				kept := map[string]any{}
				for k := range maps.Keys(rec) {
					if slices.Contains([]string{"level", "msg", "variable", "replaced_by"}, k) {
						kept[k] = rec[k]
					}
				}

				got = append(got, kept)
			}

			if len(got) != len(tt.want) {
				t.Fatalf("records = %v, want %v", got, tt.want)
			}

			for i := range got {
				if !maps.Equal(got[i], tt.want[i]) {
					t.Errorf("record %d = %v, want %v", i, got[i], tt.want[i])
				}
			}
		})
	}
}
