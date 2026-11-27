package config

import "testing"

func TestDefaultDataDir(t *testing.T) {
	t.Parallel()

	env := func(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

	tests := []struct {
		goos string
		env  map[string]string
		exe  string
		want string
	}{
		{"linux", map[string]string{"HOME": "/home/a"}, "", "/home/a/.local/share/equori"},
		{
			"linux",
			map[string]string{"HOME": "/home/a", "XDG_DATA_HOME": "/data"},
			"",
			"/data/equori",
		},
		{
			"darwin",
			map[string]string{"HOME": "/Users/a"},
			"",
			"/Users/a/Library/Application Support/equori",
		},
		{"linux", map[string]string{}, "", ""},
		{
			"windows",
			map[string]string{},
			`C:\Users\ana\AppData\Local\equori\equori.exe`,
			`C:\Users\ana\AppData\Local\equori\data`,
		},
		{
			"windows",
			map[string]string{"ProgramData": `C:\ProgramData`},
			`D:\equori\equori-cli.exe`,
			`D:\equori\data`,
		},
		{"windows", map[string]string{"HOME": "C:/a"}, "", ""},
	}
	for _, tt := range tests {
		if got := DefaultDataDir(tt.goos, env(tt.env), tt.exe); got != tt.want {
			t.Errorf(
				"DefaultDataDir(%q, %v, %q) = %q, want %q", tt.goos, tt.env, tt.exe, got, tt.want,
			)
		}
	}
}
