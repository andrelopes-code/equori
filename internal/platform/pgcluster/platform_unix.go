//go:build unix

package pgcluster

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// sun_path holds 104 bytes on macOS and 108 on Linux, the terminating NUL included.
const socketLimit = 103

// socketFallback is the socket directory of a data directory whose run/ is over socketLimit.
func socketFallback(abs string) (string, error) {
	sum := sha256.Sum256([]byte(abs))
	return filepath.Join(os.TempDir(), "equori-"+hex.EncodeToString(sum[:])[:12]), nil
}

func lockFile(f *os.File) error {
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		if errors.Is(err, syscall.EWOULDBLOCK) {
			return ErrBusy
		}
		return fmt.Errorf("lock data directory: %w", err)
	}
	return nil
}

// privateDir creates path with mode 0700 and refuses one that another user could enter:
// the fallback of socketDir lives in a shared temporary directory.
func privateDir(path string) error {
	if err := os.MkdirAll(path, 0o700); err != nil {
		return fmt.Errorf("create %s: %w", path, err)
	}
	info, err := os.Lstat(path)
	if err != nil {
		return fmt.Errorf("inspect %s: %w", path, err)
	}
	st, ok := info.Sys().(*syscall.Stat_t)
	if !info.IsDir() || info.Mode().Perm() != 0o700 || !ok || int(st.Uid) != os.Getuid() {
		return fmt.Errorf("%s must be a directory of this user with mode 0700, found %v", path, info.Mode())
	}
	return nil
}

func checkPrivileges() error { return refuseRoot(os.Geteuid()) }

func refuseRoot(euid int) error {
	if euid == 0 {
		return ErrRoot
	}
	return nil
}

type proc struct{}

// newProc gives the server its own process group: a terminal's Ctrl-C reaches serve only, which
// stops the server last.
func newProc(cmd *exec.Cmd) (*proc, error) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	return &proc{}, nil
}

func (p *proc) started(*exec.Cmd) error { return nil }

// stop asks for a fast shutdown, or an immediate one, which the next start recovers from.
func (p *proc) stop(c *Cluster, immediate bool) error {
	sig := syscall.SIGINT
	if immediate {
		sig = syscall.SIGQUIT
	}
	if err := c.cmd.Process.Signal(sig); err != nil && !errors.Is(err, os.ErrProcessDone) {
		return fmt.Errorf("signal postgres: %w", err)
	}
	return nil
}

func (p *proc) close() {}
