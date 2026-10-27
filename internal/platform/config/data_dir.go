package config

import "path"

// DefaultDataDir is the per-user data directory of managed mode (M1), or the machine-wide one on
// Windows (W-M1); "" when the system has none.
func DefaultDataDir(goos string, getenv func(string) string) string {
	if goos == "windows" {
		// The service and the terminal commands of the account that installed it share it.
		if data := getenv("ProgramData"); data != "" {
			return data + `\equori`
		}
		return ""
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
