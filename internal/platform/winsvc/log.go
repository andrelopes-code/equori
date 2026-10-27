package winsvc

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

// OpenLog opens the log of service mode for appending (W-S4); a file over limit first moves to
// path.1, which it replaces, so the log keeps at most two generations.
func OpenLog(path string, limit int64) (*os.File, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, fmt.Errorf("create log directory: %w", err)
	}
	if info, err := os.Stat(path); err == nil && info.Size() > limit {
		if err := os.Rename(path, path+".1"); err != nil {
			return nil, fmt.Errorf("rotate %s: %w", path, err)
		}
	} else if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return nil, fmt.Errorf("inspect %s: %w", path, err)
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600) //nolint:gosec // G304: the data directory is the owner's configuration.
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	return f, nil
}
