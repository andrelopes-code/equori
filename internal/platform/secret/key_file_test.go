package secret

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadOrCreateKey(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "data", "secret.key")
	first, err := LoadOrCreateKey(path)
	if err != nil || len(first) != 32 {
		t.Fatalf("first call: %d bytes, %v", len(first), err)
	}
	assertPrivateMode(t, path)
	second, err := LoadOrCreateKey(path)
	if err != nil || second != first {
		t.Fatal("second call returned another key")
	}
	raw, _ := os.ReadFile(path)
	if strings.TrimSpace(string(raw)) != base64.StdEncoding.EncodeToString([]byte(first)) {
		t.Fatalf("file = %q", raw)
	}
}

func TestLoadOrCreateKeyRejectsAShortKey(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "secret.key")
	if err := os.WriteFile(path, []byte(base64.StdEncoding.EncodeToString(make([]byte, 16))+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadOrCreateKey(path); err == nil {
		t.Fatal("a 16-byte key: want an error")
	}
}
