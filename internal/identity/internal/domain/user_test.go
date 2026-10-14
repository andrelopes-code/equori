package domain

import (
	"errors"
	"strings"
	"testing"
)

func TestNormalizeEmail(t *testing.T) {
	tests := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{in: "ann@example.com", want: "ann@example.com"},
		{in: "  Ann@Example.COM ", want: "ann@example.com"},
		{in: "", wantErr: true},
		{in: "ann", wantErr: true},
		{in: "Ann <ann@example.com>", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			got, err := NormalizeEmail(tt.in)
			if tt.wantErr {
				if !errors.Is(err, ErrInvalidEmail) {
					t.Fatalf("err = %v, want ErrInvalidEmail", err)
				}
				return
			}
			if err != nil || got != tt.want {
				t.Fatalf("got %q, %v; want %q", got, err, tt.want)
			}
		})
	}
}

func TestValidatePassword(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want error
	}{
		{name: "11 characters", in: strings.Repeat("a", 11), want: ErrPasswordTooShort},
		{name: "12 characters", in: strings.Repeat("a", 12), want: nil},
		{name: "12 multibyte characters", in: strings.Repeat("ç", 12), want: nil},
		{name: "256 characters", in: strings.Repeat("a", 256), want: nil},
		{name: "257 characters", in: strings.Repeat("a", 257), want: ErrPasswordTooLong},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := ValidatePassword(tt.in); !errors.Is(err, tt.want) {
				t.Fatalf("err = %v, want %v", err, tt.want)
			}
		})
	}
}
