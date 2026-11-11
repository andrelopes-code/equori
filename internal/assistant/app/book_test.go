package app

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func TestBookReads(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		results map[string]fakeResult
		want    []BookRead
	}{
		{
			name: "output",
			results: map[string]fakeResult{
				"list_accounts":  {res: tool.Result{Content: json.RawMessage(`{"accounts":[]}`)}},
				"list_schedules": {res: tool.Result{Content: json.RawMessage(`{"schedules":[]}`)}},
			},
			want: []BookRead{
				{Tool: "list_accounts", Text: `{"accounts":[]}`},
				{Tool: "list_schedules", Text: `{"schedules":[]}`},
			},
		},
		{
			name: "too_long",
			results: map[string]fakeResult{
				"list_accounts":  {res: tool.Result{Content: json.RawMessage(`"` + strings.Repeat("a", 12*1024) + `"`)}},
				"list_schedules": {res: tool.Result{Content: json.RawMessage(`[]`)}},
			},
			want: []BookRead{
				{Tool: "list_accounts", Text: "(too long; call list_accounts)"},
				{Tool: "list_schedules", Text: `[]`},
			},
		},
		{
			name: "error_and_error_result",
			results: map[string]fakeResult{
				"list_accounts":  {err: errors.New("boom")},
				"list_schedules": {res: tool.Result{Content: json.RawMessage(`{}`), IsError: true}},
			},
			want: []BookRead{
				{Tool: "list_accounts", Text: "(unavailable; call list_accounts)"},
				{Tool: "list_schedules", Text: "(unavailable; call list_schedules)"},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			s := &Service{tools: fakeBookTools{tt.results}}
			got := s.bookReads(t.Context(), 7)

			if len(got) != len(tt.want) {
				t.Fatalf("reads = %+v, want %+v", got, tt.want)
			}

			for i := range got {
				if got[i] != tt.want[i] {
					t.Fatalf("read %d = %+v, want %+v", i, got[i], tt.want[i])
				}
			}
		})
	}
}

type fakeResult struct {
	res tool.Result
	err error
}

type fakeBookTools struct{ results map[string]fakeResult }

func (f fakeBookTools) Call(ctx context.Context, name string, args json.RawMessage) (tool.Result, error) {
	if id, ok := auth.BooksID(ctx); !ok || id != 7 || string(args) != "{}" {
		return tool.Result{}, errors.New("unexpected context or arguments")
	}

	r, ok := f.results[name]
	if !ok {
		return tool.Result{}, tool.ErrUnknownTool
	}

	return r.res, r.err
}

func (fakeBookTools) Preview(context.Context, string, json.RawMessage) (tool.Preview, tool.Result, error) {
	return tool.Preview{}, tool.Result{}, nil
}

func (fakeBookTools) Validate(string, json.RawMessage) (tool.Result, error) {
	return tool.Result{}, nil
}

func (fakeBookTools) Effect(string) (tool.Effect, bool) { return 0, false }
