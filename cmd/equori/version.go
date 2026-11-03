package main

import (
	"fmt"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/reporting"
)

// versionText is the output of equori version; the release smoke test and the Homebrew test read its first line.
func versionText(app string) (string, error) {
	schema, err := postgres.LatestVersion()
	if err != nil {
		return "", err
	}

	// The release job reads the archive line into the notes (A192.2).
	return fmt.Sprintf(
		"equori %s\nschema %d\npostgresql >= %d\narchive %d\n",
		app,
		schema,
		postgres.MinMajor,
		reporting.ArchiveVersion,
	), nil
}
