package tool

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"testing"
)

type makeIn struct {
	Name string `json:"name"`
	Keep bool   `json:"keep,omitzero"`
}

type makeOut struct {
	ID string `json:"id"`
}

type unmakeIn struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

func TestUndo(t *testing.T) {
	t.Parallel()

	r := newUndoRegistry(t)

	s, err := r.Select("make", "unmake")
	if err != nil {
		t.Fatal(err)
	}

	only, err := r.Select("make")
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name, tool, args, result string
		set                      Set
		want                     string
		wantOK                   bool
		wantErr                  error
	}{
		{
			name:   "inverse",
			tool:   "make",
			args:   `{"name":"a"}`,
			result: `{"id":"m1"}`,
			set:    s,
			want:   `{"id":"m1","reason":"undone"}`,
			wantOK: true,
		},
		{
			name:   "call without inverse",
			tool:   "make",
			args:   `{"name":"a","keep":true}`,
			result: `{"id":"m1"}`,
			set:    s,
		},
		{name: "tool without undo", tool: "unmake", args: `{}`, result: `{}`, set: s},
		{
			name:   "inverse outside the set",
			tool:   "make",
			args:   `{"name":"a"}`,
			result: `{"id":"m1"}`,
			set:    only,
		},
		{name: "unknown tool", tool: "nope", set: s, wantErr: ErrUnknownTool},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			u, ok, err := tt.set.Undo(
				tt.tool,
				json.RawMessage(tt.args),
				json.RawMessage(tt.result),
				"undone",
			)

			if !errors.Is(err, tt.wantErr) || ok != tt.wantOK {
				t.Fatalf("ok = %v, err = %v; want %v, %v", ok, err, tt.wantOK, tt.wantErr)
			}

			if ok && (u.Tool != "unmake" || string(u.Arguments) != tt.want) {
				t.Fatalf("undo = %s %s, want unmake %s", u.Tool, u.Arguments, tt.want)
			}
		})
	}
}

func newUndoRegistry(t *testing.T) *Registry {
	t.Helper()

	none := func(context.Context, int64, makeIn) (Preview, error) { return Preview{}, nil }
	made := func(context.Context, int64, makeIn) (makeOut, error) { return makeOut{}, nil }
	make := WithUndo(
		NewWrite(Spec{Name: "make", Description: "Make one.", Effect: Write}, none, made),
		func(in makeIn, out makeOut, reason string) (string, any, bool) {
			return "unmake", unmakeIn{ID: out.ID, Reason: reason}, !in.Keep
		},
	)
	unmake := NewWrite(
		Spec{Name: "unmake", Description: "Unmake one.", Effect: Destructive},
		func(context.Context, int64, unmakeIn) (Preview, error) { return Preview{}, nil },
		func(context.Context, int64, unmakeIn) (makeOut, error) { return makeOut{}, nil },
	)

	r, err := NewRegistry(slog.New(slog.DiscardHandler), Group{Tools: []Tool{make, unmake}})
	if err != nil {
		t.Fatal(err)
	}

	return r
}
