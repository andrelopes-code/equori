package tool

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// MaxResultBytes bounds the encoded output of one call (ADR 012 T6).
const MaxResultBytes = 32 << 10

// Group is one module's tools with the mapping of its errors to tool errors.
type Group struct {
	Tools  []Tool
	Errors func(error) (Error, bool)
}

// Result is the encoded output of a call, or the encoded Error when IsError.
type Result struct {
	Content json.RawMessage
	IsError bool
}

type entry struct {
	tool   Tool
	errors func(error) (Error, bool)
}

type Registry struct {
	log     *slog.Logger
	entries map[string]entry
	names   []string
}

func NewRegistry(log *slog.Logger, groups ...Group) (*Registry, error) {
	r := &Registry{log: log, entries: map[string]entry{}}
	for _, g := range groups {
		for _, t := range g.Tools {
			name := t.spec.Name
			if _, ok := r.entries[name]; ok {
				return nil, fmt.Errorf("duplicate tool %s", name)
			}
			r.entries[name] = entry{tool: t, errors: g.Errors}
			r.names = append(r.names, name)
		}
	}
	slices.Sort(r.names)
	return r, nil
}

// Tools returns every tool, sorted by name.
func (r *Registry) Tools() []Tool {
	out := make([]Tool, len(r.names))
	for i, n := range r.names {
		out[i] = r.entries[n].tool
	}
	return out
}

func (r *Registry) Tool(name string) (Tool, bool) {
	e, ok := r.entries[name]
	return e.tool, ok
}

// Select returns the tools one consumer may call (ADR 012 T9).
func (r *Registry) Select(names ...string) (Set, error) {
	for _, n := range names {
		if _, ok := r.entries[n]; !ok {
			return Set{}, fmt.Errorf("select tool %s: %w", n, ErrUnknownTool)
		}
	}
	return Set{r: r, names: slices.Clone(names)}, nil
}

// Call runs a tool for the user in ctx. It returns a Go error only for an unknown tool, a
// context without a user and a canceled context; every other failure is a Result with IsError.
func (r *Registry) Call(ctx context.Context, name string, args json.RawMessage) (Result, error) {
	e, ok := r.entries[name]
	if !ok {
		return Result{}, fmt.Errorf("call tool %s: %w", name, ErrUnknownTool)
	}
	userID, ok := auth.UserID(ctx)
	if !ok {
		return Result{}, fmt.Errorf("call tool %s: %w", name, ErrNoUser)
	}
	start := time.Now()
	res, outcome, err := r.call(ctx, e, userID, args)
	if err != nil {
		outcome = "canceled"
	}
	r.log.LogAttrs(ctx, slog.LevelInfo, "tool call", slog.String("tool", name), slog.Int64("user_id", userID),
		slog.String("effect", e.tool.spec.Effect.String()), slog.String("outcome", outcome),
		slog.Duration("duration", time.Since(start)), slog.Int("bytes", len(res.Content)))
	return res, err
}

func (r *Registry) call(ctx context.Context, e entry, userID int64, args json.RawMessage) (Result, string, error) {
	name := e.tool.spec.Name
	if trimmed := bytes.TrimSpace(args); len(trimmed) == 0 || string(trimmed) == "null" {
		args = json.RawMessage(`{}`)
	}
	var v any
	if err := json.Unmarshal(args, &v); err != nil {
		return failure(*invalidArguments("arguments are not valid JSON: " + err.Error()))
	}
	if _, ok := v.(map[string]any); !ok {
		return failure(*invalidArguments("arguments must be a JSON object"))
	}
	if err := e.tool.in.Validate(v); err != nil {
		return failure(*invalidArguments(err.Error()))
	}
	out, err := e.tool.call(ctx, userID, args)
	if err != nil {
		if ctx.Err() != nil || errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return Result{}, "", fmt.Errorf("call tool %s: %w", name, err)
		}
		if te, ok := errors.AsType[*Error](err); ok {
			return failure(*te)
		}
		if e.errors != nil {
			if te, ok := e.errors(err); ok {
				return failure(te)
			}
		}
		return r.internal(ctx, name, err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		return r.internal(ctx, name, err)
	}
	if len(b) > MaxResultBytes {
		return failure(Error{Code: "result_too_large", Detail: fmt.Sprintf(
			"the result has %d bytes, over the limit of %d; narrow the filters or lower limit", len(b), MaxResultBytes)})
	}
	return Result{Content: b}, "ok", nil
}

func (r *Registry) internal(ctx context.Context, name string, err error) (Result, string, error) {
	r.log.LogAttrs(ctx, slog.LevelError, "tool failed", slog.String("tool", name), slog.Any("err", err))
	return failure(Error{Code: "internal_error", Detail: "the tool failed; the error is in the server log"})
}

func failure(e Error) (Result, string, error) {
	b, err := json.Marshal(e)
	if err != nil {
		return Result{}, "", err
	}
	return Result{Content: b, IsError: true}, e.Code, nil
}

// Set is the part of a registry one consumer may call.
type Set struct {
	r     *Registry
	names []string
}

func (s Set) Tools() []Tool {
	out := make([]Tool, len(s.names))
	for i, n := range s.names {
		out[i] = s.r.entries[n].tool
	}
	return out
}

func (s Set) Call(ctx context.Context, name string, args json.RawMessage) (Result, error) {
	if !slices.Contains(s.names, name) {
		return Result{}, fmt.Errorf("call tool %s: %w", name, ErrUnknownTool)
	}
	return s.r.Call(ctx, name, args)
}
