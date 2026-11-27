//go:build windows

package main

import (
	"errors"
	"fmt"
	"os"
	"time"

	"golang.org/x/sys/windows"

	"github.com/andrelopes-code/equori/internal/platform/config"
	"github.com/andrelopes-code/equori/internal/platform/pgcluster"
)

const (
	stopPollInterval = 250 * time.Millisecond
	stopTimeout      = 90 * time.Second
)

// runStop signals the instance of the data directory and waits for it to release its lock (PW3.4).
func runStop([]string) error {
	dir := config.DataDir(os.Getenv)

	name, err := windows.UTF16PtrFromString(stopEventName(dir))
	if err != nil {
		return fmt.Errorf("encode stop event name: %w", err)
	}

	event, err := windows.OpenEvent(windows.EVENT_MODIFY_STATE, false, name)
	if errors.Is(err, windows.ERROR_FILE_NOT_FOUND) {
		return nil
	}

	if err != nil {
		return fmt.Errorf("open stop event: %w", err)
	}

	defer func() { _ = windows.CloseHandle(event) }()

	if err := windows.SetEvent(event); err != nil {
		return fmt.Errorf("signal stop event: %w", err)
	}

	return waitReleased(dir)
}

func waitReleased(dir string) error {
	deadline := time.Now().Add(stopTimeout)

	for {
		held, err := pgcluster.Held(dir)
		if err != nil {
			return fmt.Errorf("check lock: %w", err)
		}

		if !held {
			return nil
		}

		if time.Now().After(deadline) {
			return errors.New("equori did not stop within 90 seconds")
		}

		time.Sleep(stopPollInterval)
	}
}
