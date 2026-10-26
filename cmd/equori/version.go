package main

import (
	"fmt"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
)

// versionText is the output of equori version; the release smoke test and the Homebrew test read its first line.
func versionText(app string) (string, error) {
	schema, err := postgres.LatestVersion()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("equori %s\nschema %d\npostgresql >= %d\n", app, schema, postgres.MinMajor), nil
}
