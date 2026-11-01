package main

import (
	"log/slog"
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

// startWarnings logs the removed and the unknown EQUORI_ variables of names and, in external mode,
// a missing secret key (A161.4, A161.7).
func startWarnings(log *slog.Logger, cfg config.Config, getenv func(string) string, names []string) {
	for _, r := range config.RemovedVariables(getenv) {
		log.Warn("environment variable removed", "variable", r.Name, "replaced_by", r.Screen)
	}

	for _, name := range names {
		if !config.Known(name) {
			log.Warn("environment variable unknown", "variable", name)
		}
	}

	if !cfg.Managed() && cfg.SecretKey == "" {
		log.Warn("EQUORI_SECRET_KEY is not set: bank connections, the second factor and the copy password are unavailable")
	}
}

// readEnvFile reads equori.env of the data directory; it returns none while EQUORI_DATABASE_URL
// is set (external mode) or no data directory is known.
func readEnvFile(getenv func(string) string) (map[string]string, error) {
	path := config.EnvFilePath(getenv)
	if path == "" {
		return nil, nil //nolint:nilnil // no file in external mode or without a data directory.
	}

	return config.ReadEnvFile(path)
}
