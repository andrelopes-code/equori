// Package logring keeps the last warn and error records of the process in memory (P13 A158).
package logring

import (
	"context"
	"log/slog"
	"maps"
	"slices"
	"sync"
	"time"
)

type Record struct {
	Time    time.Time
	Level   slog.Level
	Message string
	Attrs   map[string]string // keys of the allowlist only; values by slog.Value.String
}

// Ring is a slog.Handler that passes every record to next and keeps the warn and error ones.
type Ring struct {
	next    slog.Handler
	keys    []string
	attrs   map[string]string // allowlisted attributes of WithAttrs
	grouped bool              // after WithGroup, later attributes are left out
	buf     *buffer
}

type buffer struct {
	mu      sync.Mutex
	size    int
	records []Record
}

// New wraps next. The ring keeps at most size records and only the attributes named in keys.
func New(next slog.Handler, size int, keys []string) *Ring {
	return &Ring{next: next, keys: keys, attrs: map[string]string{}, buf: &buffer{size: size}}
}

// Records returns the kept records, oldest first.
func (r *Ring) Records() []Record {
	r.buf.mu.Lock()
	defer r.buf.mu.Unlock()

	out := slices.Clone(r.buf.records)
	for i := range out {
		out[i].Attrs = maps.Clone(out[i].Attrs)
	}

	return out
}

func (r *Ring) Enabled(ctx context.Context, level slog.Level) bool {
	return level >= slog.LevelWarn || r.next.Enabled(ctx, level)
}

func (r *Ring) Handle(ctx context.Context, rec slog.Record) error {
	if rec.Level >= slog.LevelWarn {
		r.keep(rec)
	}

	if !r.next.Enabled(ctx, rec.Level) {
		return nil
	}

	return r.next.Handle(ctx, rec)
}

func (r *Ring) WithAttrs(attrs []slog.Attr) slog.Handler {
	derived := *r
	derived.next = r.next.WithAttrs(attrs)
	derived.attrs = maps.Clone(r.attrs)

	if !r.grouped {
		r.collect(derived.attrs, attrs)
	}

	return &derived
}

func (r *Ring) WithGroup(name string) slog.Handler {
	derived := *r
	derived.next = r.next.WithGroup(name)
	derived.grouped = true

	return &derived
}

func (r *Ring) keep(rec slog.Record) {
	attrs := maps.Clone(r.attrs)

	if !r.grouped {
		rec.Attrs(func(a slog.Attr) bool {
			r.collect(attrs, []slog.Attr{a})

			return true
		})
	}

	r.buf.mu.Lock()
	defer r.buf.mu.Unlock()

	r.buf.records = append(r.buf.records, Record{Time: rec.Time, Level: rec.Level, Message: rec.Message, Attrs: attrs})
	if extra := len(r.buf.records) - r.buf.size; extra > 0 {
		r.buf.records = slices.Delete(r.buf.records, 0, extra)
	}
}

// collect copies the allowlisted attributes into dst.
func (r *Ring) collect(dst map[string]string, attrs []slog.Attr) {
	for _, a := range attrs {
		if slices.Contains(r.keys, a.Key) {
			dst[a.Key] = a.Value.Resolve().String()
		}
	}
}
