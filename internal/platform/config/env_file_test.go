package config

import (
	"maps"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestReadEnvFile(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "equori.env")
	content := "# settings\n\nEQUORI_HTTP_ADDR=127.0.0.1:9000\n  EQUORI_PRICE_FEEDS = bcb_ptax,ecb  \nEQUORI_EMPTY=\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := ReadEnvFile(path)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{"EQUORI_HTTP_ADDR": "127.0.0.1:9000", "EQUORI_PRICE_FEEDS": "bcb_ptax,ecb", "EQUORI_EMPTY": ""}
	if !maps.Equal(got, want) {
		t.Fatalf("ReadEnvFile = %v, want %v", got, want)
	}
}

func TestReadEnvFileErrors(t *testing.T) {
	t.Parallel()
	for _, content := range []string{"NO_EQUALS_SIGN\n", "lower=case\n", "1START=x\n"} {
		path := filepath.Join(t.TempDir(), "equori.env")
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
		if _, err := ReadEnvFile(path); err == nil || !strings.Contains(err.Error(), "line 1") {
			t.Errorf("ReadEnvFile(%q) error = %v, want one naming line 1", content, err)
		}
	}
}

func TestReadEnvFileMissing(t *testing.T) {
	t.Parallel()
	got, err := ReadEnvFile(filepath.Join(t.TempDir(), "absent.env"))
	if err != nil || len(got) != 0 {
		t.Fatalf("missing file: %v, %v", got, err)
	}
}

func TestWithFile(t *testing.T) {
	t.Parallel()
	process := map[string]string{"A": "process", "B": ""}
	getenv := WithFile(func(k string) string { return process[k] }, map[string]string{"A": "file", "B": "file", "C": "file"})
	for key, want := range map[string]string{"A": "process", "B": "file", "C": "file", "D": ""} {
		if got := getenv(key); got != want {
			t.Errorf("getenv(%q) = %q, want %q", key, got, want)
		}
	}
}
