package main

import (
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net"
	"os"
	"path/filepath"

	"github.com/andrelopes-code/equori/internal/platform/config"
)

// setupURL is the address of the first-user screen (W-U1). The token rides in the fragment,
// which no request carries to a server or to a proxy log.
func setupURL(addr, token string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		host, port = "", addr
	}
	if ip := net.ParseIP(host); host == "" || (ip != nil && ip.IsUnspecified()) {
		host = "127.0.0.1"
	}
	return "http://" + net.JoinHostPort(host, port) + "/setup#token=" + token
}

// announceSetup logs the setup URL while no user exists and, in managed mode, keeps it in
// setup.url for the Windows installer; without a token it removes a file left behind (W-U5).
func announceSetup(cfg config.Config, log *slog.Logger, token string) error {
	if token != "" {
		url := setupURL(cfg.HTTPAddr, token)
		log.Info("first user setup", "url", url)
		if cfg.Managed() {
			if err := os.WriteFile(setupFile(cfg), []byte(url+"\n"), 0o600); err != nil {
				return fmt.Errorf("write setup.url: %w", err)
			}
		}
		return nil
	}
	return removeSetupFile(cfg)
}

func setupFile(cfg config.Config) string { return filepath.Join(cfg.DataDir, "setup.url") }

func removeSetupFile(cfg config.Config) error {
	if !cfg.Managed() {
		return nil
	}
	if err := os.Remove(setupFile(cfg)); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("remove setup.url: %w", err)
	}
	return nil
}
