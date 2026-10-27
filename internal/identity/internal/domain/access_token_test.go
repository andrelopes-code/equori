package domain

import (
	"bytes"
	"errors"
	"regexp"
	"testing"
	"time"
)

// Design 2026-10-26 X5-X7.
func TestNewAccessToken(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	text, tok, err := NewAccessToken(7, "Claude Code", "read", 90, now)
	if err != nil {
		t.Fatal(err)
	}
	if !regexp.MustCompile(`^eqt_[A-Z2-7]{52}$`).MatchString(text) {
		t.Fatalf("token = %q", text)
	}
	if !bytes.Equal(HashToken(text), tok.TokenHash) || tok.UserID != 7 || tok.Scope != "read" || tok.Name != "Claude Code" ||
		!tok.CreatedAt.Equal(now) || !tok.ExpiresAt.Equal(now.AddDate(0, 0, 90)) {
		t.Fatalf("token = %+v", tok)
	}
	for _, tt := range []struct {
		name, scope string
		days        int
		field       string
	}{{"x", "read", 7, "expires_in_days"}, {"x", "admin", 30, "scope"}, {" ", "write", 365, "name"}} {
		_, _, err := NewAccessToken(7, tt.name, tt.scope, tt.days, now)
		if fe, ok := errors.AsType[*FieldError](err); !ok || fe.Field != tt.field {
			t.Errorf("NewAccessToken(%q, %q, %d) = %v, want field %s", tt.name, tt.scope, tt.days, err, tt.field)
		}
	}
}
