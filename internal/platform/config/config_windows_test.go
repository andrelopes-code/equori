package config

import (
	"os"
	"path/filepath"
	"testing"
)

// PW4.1: without EQUORI_DATABASE_URL and EQUORI_DATA_DIR, Windows runs managed mode in data beside
// the executable.
func TestLoadKeepsDataBesideTheExecutable(t *testing.T) {
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}

	cfg, err := Load(func(string) string { return "" }, Families{})
	if err != nil {
		t.Fatal(err)
	}

	if want := filepath.Join(filepath.Dir(exe), "data"); cfg.DataDir != want {
		t.Fatalf("DataDir = %q, want %q", cfg.DataDir, want)
	}

	if cfg.HTTPAddr != "127.0.0.1:8080" {
		t.Fatalf("HTTPAddr = %q, want 127.0.0.1:8080", cfg.HTTPAddr)
	}
}
