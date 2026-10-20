package tool

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

type echoIn struct {
	Text  string `json:"text"`
	Limit int    `json:"limit,omitzero"`
	On    Date   `json:"on,omitzero"`
	// Size asks for an output of that many bytes.
	Size int `json:"size,omitzero"`
}

type echoOut struct {
	Text string `json:"text"`
}

type failIn struct {
	Kind string `json:"kind"`
}

type optionalIn struct {
	Text string `json:"text,omitzero"`
}

var errNotFound = errors.New("not found")

func newTestRegistry(t *testing.T) (*Registry, *bytes.Buffer) {
	t.Helper()
	echo := New(Spec{Name: "echo", Description: "Echo the text.", Effect: ReadOnly},
		func(_ context.Context, _ int64, in echoIn) (echoOut, error) {
			if in.Size > 0 {
				return echoOut{Text: strings.Repeat("x", in.Size)}, nil
			}
			return echoOut{Text: in.Text}, nil
		})
	fail := New(Spec{Name: "fail", Description: "Fail as asked.", Effect: Write},
		func(ctx context.Context, _ int64, in failIn) (echoOut, error) {
			switch in.Kind {
			case "tool":
				return echoOut{}, &Error{Code: "invalid_arguments", Detail: "d", Errors: []FieldError{{Field: "account_id", Message: "is not a UUID"}}}
			case "mapped":
				return echoOut{}, errNotFound
			case "canceled":
				return echoOut{}, ctx.Err()
			}
			return echoOut{}, errors.New("pq: secret")
		})
	optional := New(Spec{Name: "optional", Description: "Echo an optional text.", Effect: ReadOnly},
		func(_ context.Context, _ int64, in optionalIn) (echoOut, error) { return echoOut(in), nil })
	logs := &bytes.Buffer{}
	r, err := NewRegistry(slog.New(slog.NewTextHandler(logs, nil)),
		Group{Tools: []Tool{echo, optional}},
		Group{Tools: []Tool{fail}, Errors: func(err error) (Error, bool) {
			if errors.Is(err, errNotFound) {
				return Error{Code: "not_found", Detail: "resource not found"}, true
			}
			return Error{}, false
		}})
	if err != nil {
		t.Fatal(err)
	}
	return r, logs
}

func userCtx(t *testing.T) context.Context { return auth.WithUserID(t.Context(), 7) }

// assertError checks that r is a tool error with code whose detail contains detail.
func assertError(t *testing.T, r Result, code, detail string) {
	t.Helper()
	if !r.IsError {
		t.Fatalf("result is not an error: %s", r.Content)
	}
	var e Error
	if err := json.Unmarshal(r.Content, &e); err != nil {
		t.Fatal(err)
	}
	if e.Code != code || !strings.Contains(e.Detail, detail) {
		t.Errorf("error = %s, want code %s with detail containing %q", r.Content, code, detail)
	}
}

func TestRegistry(t *testing.T) {
	t.Run("duplicate", func(t *testing.T) {
		echo := New(Spec{Name: "echo", Description: "d", Effect: ReadOnly},
			func(context.Context, int64, echoIn) (echoOut, error) { return echoOut{}, nil })
		_, err := NewRegistry(slog.Default(), Group{Tools: []Tool{echo}}, Group{Tools: []Tool{echo}})
		if err == nil || !strings.Contains(err.Error(), "duplicate tool echo") {
			t.Errorf("err = %v", err)
		}
	})
	t.Run("tools are sorted by name", func(t *testing.T) {
		r, _ := newTestRegistry(t)
		var names []string
		for _, tl := range r.Tools() {
			names = append(names, tl.Spec().Name)
		}
		if strings.Join(names, ",") != "echo,fail,optional" {
			t.Errorf("names = %v", names)
		}
	})
	t.Run("select unknown", func(t *testing.T) {
		r, _ := newTestRegistry(t)
		if _, err := r.Select("echo", "nope"); !errors.Is(err, ErrUnknownTool) {
			t.Errorf("err = %v", err)
		}
	})
	t.Run("unknown tool", func(t *testing.T) {
		r, _ := newTestRegistry(t)
		if _, err := r.Call(userCtx(t), "nope", nil); !errors.Is(err, ErrUnknownTool) {
			t.Errorf("err = %v", err)
		}
	})
	t.Run("no user", func(t *testing.T) {
		r, _ := newTestRegistry(t)
		if _, err := r.Call(t.Context(), "echo", []byte(`{"text":"hi"}`)); !errors.Is(err, ErrNoUser) {
			t.Errorf("err = %v", err)
		}
	})
	t.Run("ok", func(t *testing.T) {
		r, logs := newTestRegistry(t)
		res, err := r.Call(userCtx(t), "echo", []byte(`{"text":"hi"}`))
		if err != nil {
			t.Fatal(err)
		}
		if res.IsError || string(res.Content) != `{"text":"hi"}` {
			t.Errorf("result = %+v", res)
		}
		line := logs.String()
		for _, want := range []string{`msg="tool call"`, "tool=echo", "user_id=7", "effect=read_only", "outcome=ok", "bytes=13", "duration="} {
			if !strings.Contains(line, want) {
				t.Errorf("log %q lacks %q", line, want)
			}
		}
		if strings.Contains(line, "hi") {
			t.Errorf("log %q contains the arguments", line)
		}
	})
	t.Run("null and empty arguments", func(t *testing.T) {
		r, _ := newTestRegistry(t)
		for _, args := range []string{"", "null", " ", "{}"} {
			res, err := r.Call(userCtx(t), "optional", []byte(args))
			if err != nil {
				t.Fatal(err)
			}
			if res.IsError || string(res.Content) != `{"text":""}` {
				t.Errorf("args %q: result = %s", args, res.Content)
			}
		}
	})
	t.Run("invalid arguments", func(t *testing.T) {
		r, logs := newTestRegistry(t)
		tests := []struct{ name, args, detail string }{
			{"missing required", `{}`, "text"},
			{"unknown member", `{"text":"a","x":1}`, "x"},
			{"wrong type", `{"text":1}`, "text"},
			{"not an object", `[1]`, "object"},
			{"not JSON", `{`, "JSON"},
			{"invalid date", `{"text":"a","on":"2026-13-01"}`, "2026-13-01"},
		}
		for _, tt := range tests {
			res, err := r.Call(userCtx(t), "echo", []byte(tt.args))
			if err != nil {
				t.Fatalf("%s: %v", tt.name, err)
			}
			assertError(t, res, "invalid_arguments", tt.detail)
		}
		if !strings.Contains(logs.String(), "outcome=invalid_arguments") {
			t.Errorf("logs = %s", logs)
		}
	})
	t.Run("handler tool error", func(t *testing.T) {
		r, _ := newTestRegistry(t)
		res, err := r.Call(userCtx(t), "fail", []byte(`{"kind":"tool"}`))
		if err != nil {
			t.Fatal(err)
		}
		want := `{"code":"invalid_arguments","detail":"d","errors":[{"field":"account_id","message":"is not a UUID"}]}`
		if !res.IsError || string(res.Content) != want {
			t.Errorf("result = %s, want %s", res.Content, want)
		}
	})
	t.Run("mapped error", func(t *testing.T) {
		r, logs := newTestRegistry(t)
		res, err := r.Call(userCtx(t), "fail", []byte(`{"kind":"mapped"}`))
		if err != nil {
			t.Fatal(err)
		}
		if want := `{"code":"not_found","detail":"resource not found"}`; !res.IsError || string(res.Content) != want {
			t.Errorf("result = %s, want %s", res.Content, want)
		}
		if !strings.Contains(logs.String(), "outcome=not_found") || !strings.Contains(logs.String(), "effect=write") {
			t.Errorf("logs = %s", logs)
		}
	})
	t.Run("unmapped error", func(t *testing.T) {
		r, logs := newTestRegistry(t)
		res, err := r.Call(userCtx(t), "fail", []byte(`{"kind":"other"}`))
		if err != nil {
			t.Fatal(err)
		}
		assertError(t, res, "internal_error", "the tool failed; the error is in the server log")
		if strings.Contains(string(res.Content), "pq") {
			t.Errorf("result leaks the error: %s", res.Content)
		}
		if !strings.Contains(logs.String(), "pq: secret") {
			t.Errorf("logs lack the error: %s", logs)
		}
	})
	t.Run("canceled", func(t *testing.T) {
		r, _ := newTestRegistry(t)
		ctx, cancel := context.WithCancel(userCtx(t))
		cancel()
		if _, err := r.Call(ctx, "fail", []byte(`{"kind":"canceled"}`)); !errors.Is(err, context.Canceled) {
			t.Errorf("err = %v", err)
		}
	})
	t.Run("too large", func(t *testing.T) {
		r, _ := newTestRegistry(t)
		res, err := r.Call(userCtx(t), "echo", []byte(`{"text":"a","size":40000}`))
		if err != nil {
			t.Fatal(err)
		}
		assertError(t, res, "result_too_large", "32768")
		assertError(t, res, "result_too_large", "limit")
	})
	t.Run("set boundary", func(t *testing.T) {
		r, _ := newTestRegistry(t)
		s, err := r.Select("echo")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := s.Call(userCtx(t), "fail", []byte(`{"kind":"tool"}`)); !errors.Is(err, ErrUnknownTool) {
			t.Errorf("err = %v", err)
		}
		if res, err := s.Call(userCtx(t), "echo", []byte(`{"text":"hi"}`)); err != nil || string(res.Content) != `{"text":"hi"}` {
			t.Errorf("result = %+v, %v", res, err)
		}
		if len(s.Tools()) != 1 || s.Tools()[0].Spec().Name != "echo" {
			t.Errorf("tools = %v", s.Tools())
		}
	})
}

func TestFromProblem(t *testing.T) {
	d := problem.New(http.StatusNotFound, "not_found", "x")
	d.Errors = []problem.FieldError{{Field: "id", Message: "unknown"}}
	m := FromProblem(func(error) (problem.Details, bool) { return d, true })
	got, ok := m(errNotFound)
	if !ok || got.Code != "not_found" || got.Detail != "x" || len(got.Errors) != 1 || got.Errors[0] != (FieldError{Field: "id", Message: "unknown"}) {
		t.Errorf("FromProblem = %+v, %v", got, ok)
	}
	if _, ok := FromProblem(func(error) (problem.Details, bool) { return problem.Details{}, false })(errNotFound); ok {
		t.Error("unmapped error reported as mapped")
	}
}
