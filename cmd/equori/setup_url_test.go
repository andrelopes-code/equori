package main

import (
	"bytes"
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/config"
)

// W-U1: the setup URL names a host a browser on the same computer reaches.
func TestSetupURL(t *testing.T) {
	t.Parallel()
	tests := []struct{ addr, want string }{
		{":8080", "http://127.0.0.1:8080/setup#token=T"},
		{"0.0.0.0:8080", "http://127.0.0.1:8080/setup#token=T"},
		{"127.0.0.1:9000", "http://127.0.0.1:9000/setup#token=T"},
		{"[::1]:8080", "http://[::1]:8080/setup#token=T"},
	}
	for _, tt := range tests {
		if got := setupURL(tt.addr, "T"); got != tt.want {
			t.Errorf("setupURL(%q) = %q, want %q", tt.addr, got, tt.want)
		}
	}
}

// W-U1, W-U5: managed mode writes setup.url while a token exists and removes it afterwards.
func TestAnnounceSetup(t *testing.T) {
	t.Parallel()
	cfg := config.Config{DataDir: t.TempDir(), HTTPAddr: "127.0.0.1:8080"}
	var logs bytes.Buffer
	log := slog.New(slog.NewJSONHandler(&logs, nil))
	if err := announceSetup(cfg, log, "T"); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(cfg.DataDir, "setup.url")
	if b, err := os.ReadFile(path); err != nil || string(b) != "http://127.0.0.1:8080/setup#token=T\n" {
		t.Fatalf("setup.url = %q, %v", b, err)
	}
	if !strings.Contains(logs.String(), `"msg":"first user setup"`) || !strings.Contains(logs.String(), "#token=T") {
		t.Fatalf("log = %s; want the setup URL", logs.String())
	}
	if err := announceSetup(cfg, log, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("setup.url after the first user: %v; want it removed", err)
	}
}
