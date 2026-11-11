package main

import (
	"fmt"
	"runtime/debug"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
	"github.com/andrelopes-code/equori/internal/reporting"
)

// version is set at build time with -ldflags "-X main.version=...".
var version string

// printVersion writes the output of equori version.
func printVersion() error {
	text, err := versionText(buildVersion())
	if err != nil {
		return err
	}

	fmt.Print(text)

	return nil
}

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

func buildVersion() string {
	if version != "" {
		return version
	}

	if info, ok := debug.ReadBuildInfo(); ok {
		return info.Main.Version
	}

	return "unknown"
}
