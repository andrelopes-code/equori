package secret

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// LoadOrCreateKey keeps the key of managed mode beside the data and outside every dump (ADR 008, K2).
func LoadOrCreateKey(path string) (string, error) {
	b, err := os.ReadFile(path) //nolint:gosec // G304: the data directory is the owner's configuration.
	if errors.Is(err, fs.ErrNotExist) {
		return createKey(path)
	}
	if err != nil {
		return "", fmt.Errorf("read %s: %w", path, err)
	}
	key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(b)))
	if err != nil || len(key) != KeySize {
		return "", fmt.Errorf("%s must hold 32 bytes in standard base64", path)
	}
	return string(key), nil
}

func createKey(path string) (string, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return "", fmt.Errorf("create key directory: %w", err)
	}
	key := make([]byte, KeySize)
	if _, err := rand.Read(key); err != nil {
		return "", fmt.Errorf("generate key: %w", err)
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600) //nolint:gosec // G304: as above.
	if err != nil {
		return "", fmt.Errorf("create %s: %w", path, err)
	}
	_, err = f.WriteString(base64.StdEncoding.EncodeToString(key) + "\n")
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return "", fmt.Errorf("write %s: %w", path, err)
	}
	return string(key), nil
}
