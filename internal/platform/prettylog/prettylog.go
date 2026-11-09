// Package prettylog writes slog records as one readable line for a terminal.
package prettylog

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	reset = "\x1b[0m"
	dim   = "\x1b[2m"
)

// Handler prints "15:04:05.000 LEVEL message key=value". A slice attribute takes one indented
// line per element, so a list of field errors stays readable.
type Handler struct {
	mu    *sync.Mutex
	w     io.Writer
	level slog.Leveler
	color bool
	group string
	attrs []slog.Attr // keys already carry the group prefix
}

func New(w io.Writer, level slog.Leveler, color bool) *Handler {
	return &Handler{mu: &sync.Mutex{}, w: w, level: level, color: color}
}

func (h *Handler) Enabled(_ context.Context, l slog.Level) bool { return l >= h.level.Level() }

func (h *Handler) WithAttrs(attrs []slog.Attr) slog.Handler {
	c := *h
	c.attrs = append([]slog.Attr(nil), h.attrs...)

	for _, a := range attrs {
		a.Key = h.group + a.Key
		c.attrs = append(c.attrs, a)
	}

	return &c
}

func (h *Handler) WithGroup(name string) slog.Handler {
	if name == "" {
		return h
	}

	c := *h
	c.group = h.group + name + "."

	return &c
}

func (h *Handler) Handle(_ context.Context, r slog.Record) error {
	var line, lists strings.Builder

	line.WriteString(r.Time.Format("15:04:05.000"))
	line.WriteString(" ")
	line.WriteString(h.paint(levelColor(r.Level), fmt.Sprintf("%-5s", levelName(r.Level))))
	line.WriteString(" ")
	line.WriteString(r.Message)

	for _, a := range h.attrs {
		h.write(&line, &lists, a)
	}

	r.Attrs(func(a slog.Attr) bool {
		a.Key = h.group + a.Key
		h.write(&line, &lists, a)

		return true
	})

	line.WriteString("\n")
	line.WriteString(lists.String())

	h.mu.Lock()
	defer h.mu.Unlock()

	_, err := io.WriteString(h.w, line.String())

	return err
}

func (h *Handler) write(line, lists *strings.Builder, a slog.Attr) {
	v := a.Value.Resolve()
	if a.Equal(slog.Attr{}) {
		return
	}

	if v.Kind() == slog.KindGroup {
		prefix := a.Key
		if prefix != "" {
			prefix += "."
		}

		for _, g := range v.Group() {
			g.Key = prefix + g.Key
			h.write(line, lists, g)
		}

		return
	}

	if rv := reflect.ValueOf(v.Any()); v.Kind() == slog.KindAny && rv.Kind() == reflect.Slice {
		for i := range rv.Len() {
			fmt.Fprintf(lists, "    %s: %v\n", a.Key, rv.Index(i).Interface())
		}

		return
	}

	line.WriteString(" ")
	line.WriteString(h.paint(dim, a.Key+"="))
	line.WriteString(format(v))
}

func (h *Handler) paint(code, s string) string {
	if !h.color {
		return s
	}

	return code + s + reset
}

func format(v slog.Value) string {
	switch v.Kind() {
	case slog.KindDuration:
		return v.Duration().Round(time.Microsecond).String()
	case slog.KindString:
		s := v.String()
		if s == "" || strings.ContainsAny(s, " \t\n\"=") {
			return strconv.Quote(s)
		}

		return s
	default:
		return v.String()
	}
}

func levelName(l slog.Level) string {
	switch {
	case l >= slog.LevelError:
		return "ERROR"
	case l >= slog.LevelWarn:
		return "WARN"
	case l >= slog.LevelInfo:
		return "INFO"
	}

	return "DEBUG"
}

func levelColor(l slog.Level) string {
	switch {
	case l >= slog.LevelError:
		return "\x1b[31m"
	case l >= slog.LevelWarn:
		return "\x1b[33m"
	case l >= slog.LevelInfo:
		return "\x1b[32m"
	}

	return "\x1b[90m"
}
