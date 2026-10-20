package tool

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"
)

type kind string

func (kind) Values() []string { return []string{"asset", "expense"} }

type searchIn struct {
	Query string `json:"query" jsonschema:"text to find"`
	Kind  kind   `json:"kind,omitzero"`
	From  Date   `json:"from,omitzero"`
	Limit int    `json:"limit,omitzero"`
}

type totalOut struct {
	Total Money `json:"total"`
}

func search(context.Context, int64, searchIn) (totalOut, error) { return totalOut{}, nil }

var searchSpec = Spec{Name: "search_things", Description: "Search things.", Effect: ReadOnly}

// assertJSON compares v, marshalled, with want as JSON values, ignoring member order.
func assertJSON(t *testing.T, v any, want string) {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	var got, exp any
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal([]byte(want), &exp); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, exp) {
		t.Errorf("got %s\nwant %s", b, want)
	}
}

func TestNewInfersSchemas(t *testing.T) {
	tl := New(searchSpec, search)
	assertJSON(t, tl.InputSchema(), `{"type":"object","additionalProperties":false,"required":["query"],"properties":{
		"query":{"type":"string","description":"text to find"},
		"kind":{"type":"string","enum":["asset","expense"]},
		"from":{"type":"string","format":"date"},
		"limit":{"type":"integer"}}}`)
	assertJSON(t, tl.OutputSchema(), `{"type":"object","additionalProperties":false,"required":["total"],"properties":{
		"total":{"type":"object","additionalProperties":false,"required":["amount","currency"],"properties":{
			"amount":{"type":"string","description":"decimal amount in the instrument's scale, such as -1234.56"},
			"currency":{"type":"string","description":"currency or instrument code"}}}}}`)
	if tl.Spec() != searchSpec {
		t.Errorf("Spec() = %+v", tl.Spec())
	}
}

func TestNewRejects(t *testing.T) {
	type withPointer struct {
		Name *string `json:"name"`
	}
	type withMap struct {
		Counts map[string]int `json:"counts"`
	}
	spec := func(name string) Spec { return Spec{Name: name, Description: "d", Effect: ReadOnly} }
	tests := []struct {
		name string
		new  func()
		text string
	}{
		{"uppercase name", func() { New(spec("Search"), search) }, "name"},
		{"name starting with a digit", func() { New(spec("9x"), search) }, "name"},
		{"name of 65 characters", func() { New(spec("a"+strings.Repeat("b", 64)), search) }, "name"},
		{"empty description", func() { New(Spec{Name: "x", Effect: ReadOnly}, search) }, "description"},
		{"zero effect", func() { New(Spec{Name: "x", Description: "d"}, search) }, "effect"},
		{"input not a struct", func() {
			New(spec("x"), func(context.Context, int64, string) (totalOut, error) { return totalOut{}, nil })
		}, "object"},
		{"pointer field", func() {
			New(spec("x"), func(context.Context, int64, withPointer) (totalOut, error) { return totalOut{}, nil })
		}, "type"},
		{"map field", func() {
			New(spec("x"), func(context.Context, int64, withMap) (totalOut, error) { return totalOut{}, nil })
		}, "additionalProperties"},
		{"output not a struct", func() {
			New(spec("x"), func(context.Context, int64, searchIn) ([]int, error) { return nil, nil })
		}, "object"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defer func() {
				r := recover()
				if r == nil {
					t.Fatal("New did not panic")
				}
				if msg := fmt.Sprint(r); !strings.Contains(msg, tt.text) {
					t.Errorf("panic %q does not mention %q", msg, tt.text)
				}
			}()
			tt.new()
		})
	}
}

func TestValidateOutput(t *testing.T) {
	tl := New(searchSpec, search)
	if err := tl.ValidateOutput([]byte(`{"total":{"amount":"1.00","currency":"BRL"}}`)); err != nil {
		t.Errorf("valid output: %v", err)
	}
	if err := tl.ValidateOutput([]byte(`{"total":{"amount":1}}`)); err == nil {
		t.Error("invalid output passed")
	}
}
