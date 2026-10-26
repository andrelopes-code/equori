package config

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"regexp"
	"strings"
)

var envKey = regexp.MustCompile(`^[A-Z_][A-Z0-9_]*$`)

// ReadEnvFile reads equori.env of managed mode (C2): one KEY=VALUE per line, # starts a comment
// line, no quoting, no expansion. A missing file yields an empty map.
func ReadEnvFile(path string) (map[string]string, error) {
	b, err := os.ReadFile(path) //nolint:gosec // G304: the data directory is the owner's configuration.
	if errors.Is(err, fs.ErrNotExist) {
		return map[string]string{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	values := map[string]string{}
	for n, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		key = strings.TrimSpace(key)
		if !ok || !envKey.MatchString(key) {
			return nil, fmt.Errorf("%s line %d: want KEY=VALUE with KEY in upper case", path, n+1)
		}
		values[key] = strings.TrimSpace(value)
	}
	return values, nil
}

// WithFile returns a getenv in which a non-empty process value wins over the file's value.
func WithFile(getenv func(string) string, file map[string]string) func(string) string {
	return func(key string) string {
		if v := getenv(key); v != "" {
			return v
		}
		return file[key]
	}
}
