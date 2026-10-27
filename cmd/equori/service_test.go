package main

import (
	"os"
	"path/filepath"
	"testing"
)

// W-S2: service install writes the loopback address once and keeps the owner's settings.
func TestWriteDefaultEnv(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "equori.env")
	if err := writeDefaultEnv(path); err != nil {
		t.Fatal(err)
	}
	if b, err := os.ReadFile(path); err != nil || string(b) != "EQUORI_HTTP_ADDR=127.0.0.1:8080\n" {
		t.Fatalf("equori.env = %q, %v", b, err)
	}
	if err := os.WriteFile(path, []byte("EQUORI_HTTP_ADDR=:9000\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := writeDefaultEnv(path); err != nil {
		t.Fatal(err)
	}
	if b, err := os.ReadFile(path); err != nil || string(b) != "EQUORI_HTTP_ADDR=:9000\n" {
		t.Fatalf("equori.env after a second install = %q, %v; want the owner's value", b, err)
	}
}
