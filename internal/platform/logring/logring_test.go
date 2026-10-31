package logring_test

import (
	"bytes"
	"log/slog"
	"maps"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/logring"
)

func TestRing(t *testing.T) {
	t.Parallel()

	type kept struct {
		message string
		attrs   map[string]string
	}

	tests := []struct {
		name string
		size int
		want []kept
	}{
		{"size 10", 10, []kept{
			{"b", map[string]string{"code": "x"}},
			{"c", map[string]string{"code": "y"}},
			{"d", map[string]string{}},
			{"e", map[string]string{}},
		}},
		{"size 2", 2, []kept{
			{"d", map[string]string{}},
			{"e", map[string]string{}},
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var buf bytes.Buffer

			next := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
			ring := logring.New(next, tt.size, []string{"code"})
			log := slog.New(ring)

			log.Info("a")
			log.Warn("b", "code", "x", "error", "secret")
			log.With("code", "y").Error("c")
			log.WithGroup("g").Warn("d", "code", "z")
			log.Warn("e")

			got := ring.Records()
			if len(got) != len(tt.want) {
				t.Fatalf("records = %d, want %d: %+v", len(got), len(tt.want), got)
			}

			for i, w := range tt.want {
				if got[i].Message != w.message || !maps.Equal(got[i].Attrs, w.attrs) {
					t.Errorf("record %d = %q %v, want %q %v", i, got[i].Message, got[i].Attrs, w.message, w.attrs)
				}
			}

			out := buf.String()
			for _, s := range []string{"msg=a", "msg=b", "msg=c", "msg=d", "msg=e", "secret"} {
				if !strings.Contains(out, s) {
					t.Errorf("next output lacks %q: %s", s, out)
				}
			}
		})
	}
}
