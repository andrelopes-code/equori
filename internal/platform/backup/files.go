package backup

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"time"
)

const (
	Manual       = "equori"
	Periodic     = "periodic"
	PreMigration = "pre-migration"
)

// Name is the file name of a backup (B1); the date sorts lexically, so name order is age order.
func Name(prefix string, day time.Time, schema int64) string {
	return fmt.Sprintf("%s-%s-s%d.dump", prefix, day.Format(time.DateOnly), schema)
}

func list(dir, prefix string) ([]string, error) {
	names, err := filepath.Glob(filepath.Join(dir, prefix+"-*.dump"))
	if err != nil {
		return nil, fmt.Errorf("list backups: %w", err)
	}
	slices.Sort(names)
	return names, nil
}

// Prune deletes all but the keep newest backups of prefix (B3).
func Prune(dir, prefix string, keep int) error {
	names, err := list(dir, prefix)
	if err != nil {
		return err
	}
	for _, name := range names[:max(0, len(names)-keep)] {
		if err := os.Remove(name); err != nil {
			return fmt.Errorf("prune backup: %w", err)
		}
	}
	return nil
}

// Newest returns the path of the newest backup of prefix, or "" when none exists.
func Newest(dir, prefix string) (string, error) {
	names, err := list(dir, prefix)
	if err != nil || len(names) == 0 {
		return "", err
	}
	return names[len(names)-1], nil
}

// Due reports whether the newest periodic backup is at least every old, or absent.
func Due(dir string, now time.Time, every time.Duration) (bool, error) {
	newest, err := Newest(dir, Periodic)
	if err != nil || newest == "" {
		return err == nil, err
	}
	info, err := os.Stat(newest)
	if err != nil {
		return false, fmt.Errorf("inspect backup: %w", err)
	}
	return now.Sub(info.ModTime()) >= every, nil
}
