// Package pgcluster runs a private PostgreSQL server over a data directory (ADR 022, managed mode).
package pgcluster

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

var (
	ErrRoot        = errors.New("managed mode does not run as root: PostgreSQL refuses it")
	ErrUnsupported = errors.New("managed mode runs on Linux and macOS; set EQUORI_DATABASE_URL")
)

var versionLine = regexp.MustCompile(`\(PostgreSQL\) (\d+)`)

// Bin returns the directory of the PostgreSQL programs (M2, W-M2): explicit when set, else
// postgresql/bin beside the running executable, else the directory of postgres on PATH.
func Bin(explicit string) (string, error) {
	exe, err := os.Executable()
	if err != nil {
		exe = ""
	}
	return bin(explicit, exe)
}

func bin(explicit, exe string) (string, error) {
	if explicit != "" {
		if _, err := exec.LookPath(filepath.Join(explicit, "postgres")); err != nil {
			return "", fmt.Errorf("EQUORI_POSTGRES_BIN %s: %w", explicit, err)
		}
		return explicit, nil
	}
	if exe != "" {
		bundled := filepath.Join(filepath.Dir(exe), "postgresql", "bin")
		if _, err := exec.LookPath(filepath.Join(bundled, "postgres")); err == nil {
			return bundled, nil
		}
	}
	path, err := exec.LookPath("postgres")
	if err != nil {
		return "", fmt.Errorf("find postgres on PATH; set EQUORI_POSTGRES_BIN to the directory of the PostgreSQL programs: %w", err)
	}
	return filepath.Dir(path), nil
}

// Major returns the major version that program reports with --version.
func Major(ctx context.Context, program string) (int, error) {
	out, err := exec.CommandContext(ctx, program, "--version").Output() //nolint:gosec // G204: the programs directory is the owner's configuration.
	if err != nil {
		return 0, fmt.Errorf("run %s --version: %w", program, err)
	}
	return parseMajor(string(out))
}

func parseMajor(out string) (int, error) {
	m := versionLine.FindStringSubmatch(out)
	if m == nil {
		return 0, fmt.Errorf("parse version %q: no PostgreSQL major", strings.TrimSpace(out))
	}
	return strconv.Atoi(m[1])
}

func refuseRoot(euid int) error {
	if euid == 0 {
		return ErrRoot
	}
	return nil
}
