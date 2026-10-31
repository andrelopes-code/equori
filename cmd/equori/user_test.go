package main

import (
	"errors"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestUserSettings(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, language, region, currency string
		want                             money.Currency
		wantErr                          string
	}{
		{"region default", "pt", "BR", "", "BRL", ""},
		{"explicit currency", "en", "DE", "EUR", "EUR", ""},
		{"no default for region", "en", "DE", "", "", "--currency is required for region DE"},
		{"unknown region", "en", "ZZ", "EUR", "", "region"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			l, got, err := userSettings(tt.language, tt.region, tt.currency)
			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("err = %v, want containing %q", err, tt.wantErr)
				}

				return
			}

			if err != nil {
				t.Fatal(err)
			}

			if got != tt.want || l != (locale.Locale{Language: tt.language, Region: tt.region}) {
				t.Fatalf("got %v %v", l, got)
			}
		})
	}
}

func TestResetArgs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		args    []string
		want    string
		wantErr error
	}{
		{"email", []string{"--email", "a@b.c"}, "a@b.c", nil},
		{"no arguments", []string{}, "", errUsage},
		{"empty email", []string{"--email", ""}, "", errUsage},
		{"positional argument", []string{"--email", "a@b.c", "extra"}, "", errUsage},
		{"unknown flag", []string{"--admin"}, "", errUsage},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := resetArgs(tt.args)
			if !errors.Is(err, tt.wantErr) || got != tt.want {
				t.Fatalf("got %q, %v; want %q, %v", got, err, tt.want, tt.wantErr)
			}
		})
	}
}
