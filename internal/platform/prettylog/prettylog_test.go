package prettylog

import (
	"bytes"
	"log/slog"
	"testing"
	"time"
)

func TestHandle(t *testing.T) {
	t.Parallel()

	at := time.Date(2026, 11, 9, 19, 19, 3, 209_000_000, time.UTC)

	tests := []struct {
		name  string
		level slog.Level
		color bool
		attrs []slog.Attr
		group string
		with  []slog.Attr
		want  string
	}{
		{
			name:  "scalars, duration and quoting",
			level: slog.LevelInfo,
			attrs: []slog.Attr{
				slog.String("method", "PUT"),
				slog.Int("status", 422),
				slog.Duration("duration", 2913073*time.Nanosecond),
				slog.String("detail", "plan rows overlap"),
			},
			want: "19:19:03.209 INFO  http request method=PUT status=422 duration=2.913ms" +
				" detail=\"plan rows overlap\"\n",
		},
		{
			name:  "group prefixes its keys and a slice takes one line per element",
			level: slog.LevelWarn,
			attrs: []slog.Attr{
				slog.Group("problem",
					slog.String("code", "invalid_plan"),
					slog.Any("errors", []string{"rows[0]: must be positive", "rows[1]: required"}),
					slog.Any("none", []string{}),
				),
			},
			want: "19:19:03.209 WARN  http request problem.code=invalid_plan\n" +
				"    problem.errors: rows[0]: must be positive\n" +
				"    problem.errors: rows[1]: required\n",
		},
		{
			name:  "attributes of WithAttrs and WithGroup come before the record's",
			level: slog.LevelError,
			group: "db",
			with:  []slog.Attr{slog.String("pool", "main")},
			attrs: []slog.Attr{slog.String("op", "ping")},
			want:  "19:19:03.209 ERROR http request db.pool=main db.op=ping\n",
		},
		{
			name:  "color wraps the level and dims the keys",
			level: slog.LevelInfo,
			color: true,
			attrs: []slog.Attr{slog.String("method", "GET")},
			want:  "19:19:03.209 \x1b[32mINFO \x1b[0m http request \x1b[2mmethod=\x1b[0mGET\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var buf bytes.Buffer
			var h slog.Handler = New(&buf, slog.LevelDebug, tt.color)

			if tt.group != "" {
				h = h.WithGroup(tt.group)
			}

			if tt.with != nil {
				h = h.WithAttrs(tt.with)
			}

			r := slog.NewRecord(at, tt.level, "http request", 0)
			r.AddAttrs(tt.attrs...)

			if err := h.Handle(t.Context(), r); err != nil {
				t.Fatal(err)
			}

			if got := buf.String(); got != tt.want {
				t.Errorf("got  %q\nwant %q", got, tt.want)
			}
		})
	}
}

func TestEnabled(t *testing.T) {
	t.Parallel()

	h := New(&bytes.Buffer{}, slog.LevelWarn, false)

	if h.Enabled(t.Context(), slog.LevelInfo) || !h.Enabled(t.Context(), slog.LevelWarn) {
		t.Fatal("Enabled must follow the minimum level")
	}
}
