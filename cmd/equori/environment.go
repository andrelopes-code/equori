package main

import (
	"cmp"
	"path/filepath"
	"runtime"
	"slices"
	"strings"

	"github.com/andrelopes-code/equori/internal/platform/config"
)

const envPrefix = "EQUORI_"

// envNames returns the sorted names, without duplicates, of the EQUORI_ variables set in environ
// or in the environment file. Values never leave this function (P13 A158).
func envNames(environ []string, file map[string]string) []string {
	var names []string

	for _, kv := range environ {
		if name, _, _ := strings.Cut(kv, "="); strings.HasPrefix(name, envPrefix) {
			names = append(names, name)
		}
	}

	for name := range file {
		if strings.HasPrefix(name, envPrefix) {
			names = append(names, name)
		}
	}

	slices.Sort(names)

	return slices.Compact(names)
}

// readEnvFile reads equori.env of the data directory; it returns none while EQUORI_DATABASE_URL
// is set (external mode) or no data directory is known.
func readEnvFile(getenv func(string) string) (map[string]string, error) {
	if getenv("EQUORI_DATABASE_URL") != "" {
		return nil, nil //nolint:nilnil // no file in external mode.
	}

	dir := cmp.Or(getenv("EQUORI_DATA_DIR"), config.DefaultDataDir(runtime.GOOS, getenv))
	if dir == "" {
		return nil, nil //nolint:nilnil // no data directory, no file.
	}

	return config.ReadEnvFile(filepath.Join(dir, "equori.env"))
}
