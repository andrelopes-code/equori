package main

import (
	"fmt"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/reporting"
)

func TestVersionText(t *testing.T) {
	t.Parallel()

	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}

	got, err := versionText("v0.1.0")
	if err != nil {
		t.Fatal(err)
	}

	// S268 (A192.1)
	want := fmt.Sprintf("equori v0.1.0\nschema %d\npostgresql >= 18\narchive %d\n", latest, reporting.ArchiveVersion)
	if got != want {
		t.Fatalf("versionText() = %q, want %q", got, want)
	}
}
