package config

import (
	"cmp"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"
)

// DefaultDataDir is the per-user data directory of managed mode (M1); on Windows, data beside the
// executable (PW4.1). "" when the system has none.
func DefaultDataDir(goos string, getenv func(string) string, exe string) string {
	if goos == "windows" {
		// String operations, not filepath: the function runs for "windows" on any host.
		i := strings.LastIndex(exe, `\`)
		if i < 0 {
			return ""
		}

		return exe[:i] + `\data`
	}

	home := getenv("HOME")
	if home == "" {
		return ""
	}

	switch goos {
	case "linux":
		if xdg := getenv("XDG_DATA_HOME"); xdg != "" {
			return path.Join(xdg, "equori")
		}

		return path.Join(home, ".local", "share", "equori")
	case "darwin":
		return path.Join(home, "Library", "Application Support", "equori")
	}

	return ""
}

// DataDir is EQUORI_DATA_DIR, else DefaultDataDir of this system.
func DataDir(getenv func(string) string) string {
	exe, err := os.Executable()
	if err != nil {
		exe = ""
	}

	return cmp.Or(getenv("EQUORI_DATA_DIR"), DefaultDataDir(runtime.GOOS, getenv, exe))
}

// EnvFilePath is equori.env of the data directory; "" in external mode or without a data directory.
func EnvFilePath(getenv func(string) string) string {
	if getenv("EQUORI_DATABASE_URL") != "" {
		return ""
	}

	dir := DataDir(getenv)
	if dir == "" {
		return ""
	}

	return filepath.Join(dir, "equori.env")
}
