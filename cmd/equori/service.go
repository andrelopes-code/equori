package main

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/config"
	"github.com/andrelopes-code/equori/internal/platform/pgcluster"
	"github.com/andrelopes-code/equori/internal/platform/winsvc"
)

const serviceUsage = `usage: equori service install|stop|uninstall

install registers and starts the Windows service equori; the installer runs it as administrator.
stop stops the service and waits for it. uninstall stops and deletes it and keeps the data.`

const (
	serviceName    = "equori"
	serviceAccount = `NT SERVICE\equori`
)

func serviceCommand(args []string) error {
	if len(args) == 1 {
		switch args[0] {
		case "install":
			return installService()
		case "stop":
			return winsvc.Stop(serviceName, 90*time.Second)
		case "uninstall":
			return winsvc.Uninstall(serviceName)
		}
	}
	fmt.Fprintln(os.Stderr, serviceUsage)
	return errUsage
}

// installService registers the service before it grants the data directory to the service
// account, whose SID exists only once the service does (W-S2).
func installService() error {
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("locate equori: %w", err)
	}
	if err := winsvc.Install(serviceName, exe, []string{"serve"}, serviceAccount); err != nil {
		return err
	}
	dir := config.DefaultDataDir(runtime.GOOS, os.Getenv)
	if dir == "" {
		return errors.New("this system has no default data directory")
	}
	u, err := user.Current()
	if err != nil {
		return fmt.Errorf("read the current account: %w", err)
	}
	if err := pgcluster.PrepareDataDir(dir, serviceAccount, u.Username); err != nil {
		return err
	}
	if err := writeDefaultEnv(filepath.Join(dir, "equori.env")); err != nil {
		return err
	}
	return winsvc.Start(serviceName)
}

// writeDefaultEnv keeps the service on loopback (W-S2); a file the owner wrote stays as it is.
func writeDefaultEnv(path string) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600) //nolint:gosec // G304: the data directory is the owner's configuration.
	if errors.Is(err, fs.ErrExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("create %s: %w", path, err)
	}
	_, err = f.WriteString("EQUORI_HTTP_ADDR=127.0.0.1:8080\n")
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}
