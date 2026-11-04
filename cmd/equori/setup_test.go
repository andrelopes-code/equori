package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ADR 008, K6 amendment: external mode with a data directory keeps the key in secret.key.
func TestSetupExternalModeWritesTheKeyFile(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("EQUORI_DATABASE_URL", "postgres://equori@db/equori")
	t.Setenv("EQUORI_DATA_DIR", dir)
	t.Setenv("EQUORI_SECRET_KEY", "")

	first, _, err := setup()
	if err != nil {
		t.Fatal(err)
	}

	if len(first.SecretKey) != 32 {
		t.Fatalf("key length = %d, want 32", len(first.SecretKey))
	}

	info, err := os.Stat(filepath.Join(dir, "secret.key"))
	if err != nil {
		t.Fatal(err)
	}

	if got := info.Mode().Perm(); got != 0o600 {
		t.Fatalf("secret.key mode = %o, want 600", got)
	}

	second, _, err := setup()
	if err != nil {
		t.Fatal(err)
	}

	if second.SecretKey != first.SecretKey {
		t.Fatal("a second start generated another key")
	}
}

func TestSetupExternalModeKeepsTheVariableOverTheKeyFile(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("EQUORI_DATABASE_URL", "postgres://equori@db/equori")
	t.Setenv("EQUORI_DATA_DIR", dir)
	t.Setenv("EQUORI_SECRET_KEY", strings.Repeat("A", 43)+"=")

	cfg, _, err := setup()
	if err != nil {
		t.Fatal(err)
	}

	if cfg.SecretKey != strings.Repeat("\x00", 32) {
		t.Fatalf("key = %q, want the variable's 32 zero bytes", cfg.SecretKey)
	}

	if _, err := os.Stat(filepath.Join(dir, "secret.key")); !os.IsNotExist(err) {
		t.Fatalf("secret.key written beside an explicit key: %v", err)
	}
}

func TestSetupExternalModeWithoutDataDirectoryHasNoKey(t *testing.T) {
	t.Setenv("EQUORI_DATABASE_URL", "postgres://equori@db/equori")
	t.Setenv("EQUORI_DATA_DIR", "")
	t.Setenv("EQUORI_SECRET_KEY", "")

	cfg, _, err := setup()
	if err != nil {
		t.Fatal(err)
	}

	if cfg.SecretKey != "" {
		t.Fatal("a key appeared without a data directory")
	}
}

func TestSetupExternalModeContinuesWhenTheDataDirectoryIsNotWritable(t *testing.T) {
	file := filepath.Join(t.TempDir(), "not-a-directory")
	if err := os.WriteFile(file, nil, 0o600); err != nil {
		t.Fatal(err)
	}

	t.Setenv("EQUORI_DATABASE_URL", "postgres://equori@db/equori")
	t.Setenv("EQUORI_DATA_DIR", file)
	t.Setenv("EQUORI_SECRET_KEY", "")

	cfg, _, err := setup()
	if err != nil {
		t.Fatal(err)
	}

	if cfg.SecretKey != "" {
		t.Fatal("a key appeared from an unusable data directory")
	}
}
