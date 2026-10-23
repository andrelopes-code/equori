package domain

import (
	"errors"
	"strings"
	"testing"
)

func TestNewLimit(t *testing.T) {
	t.Parallel()
	one, zero, huge := int64(1), int64(0), int64(1<<31)
	tests := []struct {
		name, provider, model string
		requests, tokens      *int64
		wantField             string
		cleared               bool
	}{
		{name: "both", provider: "aistudio", model: "m", requests: &one, tokens: &one},
		{name: "neither clears", provider: "aistudio", model: "m", cleared: true},
		{name: "zero requests", provider: "aistudio", model: "m", requests: &zero, wantField: "requests_per_day"},
		{name: "requests past int32", provider: "aistudio", model: "m", requests: &huge, wantField: "requests_per_day"},
		{name: "zero tokens", provider: "aistudio", model: "m", tokens: &zero, wantField: "tokens_per_day"},
		{name: "blank model", provider: "aistudio", model: " ", requests: &one, wantField: "model"},
		{name: "long provider", provider: strings.Repeat("p", 61), model: "m", requests: &one, wantField: "provider_id"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			l, err := NewLimit(tt.provider, tt.model, tt.requests, tt.tokens)
			if tt.wantField != "" {
				fe, ok := errors.AsType[*FieldError](err)
				if !ok || fe.Field != tt.wantField {
					t.Fatalf("err = %v, want a field error on %s", err, tt.wantField)
				}
				return
			}
			if err != nil || l.Cleared() != tt.cleared {
				t.Fatalf("NewLimit = %+v, %v", l, err)
			}
		})
	}
}
