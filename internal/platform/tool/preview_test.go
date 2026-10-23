package tool

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"regexp"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

type renameIn struct {
	Name string `json:"name"`
}

func newPreviewRegistry(t *testing.T, field string) (*Registry, *int, *strings.Builder) {
	t.Helper()
	calls := new(int)
	rename := NewWrite(Spec{Name: "rename", Description: "Rename an account.", Effect: Write},
		func(_ context.Context, _ int64, in renameIn) (Preview, error) {
			return Preview{Action: "rename", Target: "Account Checking", Changes: []Change{
				{Field: field, Before: TextValue("Checking"), After: TextValue(in.Name)}}}, nil
		},
		func(_ context.Context, _ int64, in renameIn) (echoOut, error) {
			*calls++
			return echoOut{Text: in.Name}, nil
		})
	plain := New(Spec{Name: "plain", Description: "Plain write.", Effect: Write},
		func(context.Context, int64, renameIn) (echoOut, error) { return echoOut{}, nil })
	logs := &strings.Builder{}
	r, err := NewRegistry(slog.New(slog.NewTextHandler(logs, nil)), Group{Tools: []Tool{rename, plain}})
	if err != nil {
		t.Fatal(err)
	}
	return r, calls, logs
}

func TestNewWritePanicsOnReadOnly(t *testing.T) {
	t.Parallel()
	defer func() {
		if recover() == nil {
			t.Error("NewWrite did not panic")
		}
	}()
	NewWrite(Spec{Name: "rename", Description: "d", Effect: ReadOnly},
		func(context.Context, int64, renameIn) (Preview, error) { return Preview{}, nil },
		func(context.Context, int64, renameIn) (echoOut, error) { return echoOut{}, nil })
}

func TestRegistryPreview(t *testing.T) {
	t.Parallel()
	r, calls, _ := newPreviewRegistry(t, "name")
	p, res, err := r.Preview(userCtx(t), "rename", json.RawMessage(`{"name":"Main"}`))
	if err != nil || res.IsError {
		t.Fatalf("err = %v, res = %s", err, res.Content)
	}
	if p.Action != "rename" || p.Target != "Account Checking" || len(p.Changes) != 1 ||
		p.Changes[0].After.Text != "Main" || p.Changes[0].Before.Text != "Checking" {
		t.Errorf("preview = %+v", p)
	}
	if *calls != 0 {
		t.Errorf("handler ran %d times", *calls)
	}
	if !r.entries["rename"].tool.HasPreview() || r.entries["plain"].tool.HasPreview() {
		t.Error("HasPreview mismatch")
	}
}

func TestRegistryPreviewInvalid(t *testing.T) {
	t.Parallel()
	r, calls, _ := newPreviewRegistry(t, "name")
	_, res, err := r.Preview(userCtx(t), "rename", json.RawMessage(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	assertError(t, res, "invalid_arguments", "")
	if *calls != 0 {
		t.Errorf("handler ran %d times", *calls)
	}
}

func TestRegistryPreviewUnknownField(t *testing.T) {
	t.Parallel()
	r, _, logs := newPreviewRegistry(t, "colour")
	_, res, err := r.Preview(userCtx(t), "rename", json.RawMessage(`{"name":"Main"}`))
	if err != nil {
		t.Fatal(err)
	}
	assertError(t, res, "internal_error", "")
	if !strings.Contains(logs.String(), "tool failed") {
		t.Errorf("log = %s", logs)
	}
}

func TestRegistryPreviewWithout(t *testing.T) {
	t.Parallel()
	r, _, _ := newPreviewRegistry(t, "name")
	_, _, err := r.Preview(userCtx(t), "plain", json.RawMessage(`{"name":"x"}`))
	if !errors.Is(err, ErrNoPreview) {
		t.Errorf("err = %v", err)
	}
}

func TestPreviewDigest(t *testing.T) {
	t.Parallel()
	base := Preview{Action: "a", Changes: []Change{{Field: "name", After: TextValue("x")}}, Basis: "v1"}
	same := base
	other := base
	other.Basis = "v2"
	changed := Preview{Action: "a", Changes: []Change{{Field: "name", After: TextValue("y")}}, Basis: "v1"}
	if PreviewDigest(base) != PreviewDigest(same) {
		t.Error("equal previews differ")
	}
	if PreviewDigest(base) == PreviewDigest(other) || PreviewDigest(base) == PreviewDigest(changed) {
		t.Error("different previews collide")
	}
	if !regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(PreviewDigest(base)) {
		t.Errorf("digest = %s", PreviewDigest(base))
	}
}

func TestParseAmount(t *testing.T) {
	t.Parallel()
	unit, err := money.New(0, "BRL")
	if err != nil {
		t.Fatal(err)
	}
	_, err = ParsePositive("amount", "0", unit)
	e, ok := errors.AsType[*Error](err)
	if !ok || len(e.Errors) != 1 || e.Errors[0].Field != "amount" || e.Errors[0].Message != "must be greater than zero" {
		t.Errorf("err = %v", err)
	}
	got, err := ParseAmount("amount", "-3.10", unit)
	if err != nil || got.Amount() != -310 {
		t.Errorf("got %v, err %v", got, err)
	}
	_, err = ParseAmount("amount", "1.234", unit)
	if e, ok := errors.AsType[*Error](err); !ok || e.Errors[0].Message != "must be a decimal such as 125.90 with at most 2 decimals" {
		t.Errorf("err = %v", err)
	}
}
