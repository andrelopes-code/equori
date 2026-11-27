//go:build windows

package main

import (
	"testing"
	"time"

	"golang.org/x/sys/windows"
)

// Review focus 5: after the tray quit, `stop` returns at once.
func TestStopWithoutInstance(t *testing.T) {
	t.Setenv("EQUORI_DATA_DIR", t.TempDir())

	done := make(chan error, 1)

	go func() { done <- runStop(nil) }()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("runStop = %v, want nil", err)
		}
	case <-time.After(time.Second):
		t.Fatal("runStop did not return within 1 s")
	}
}

// PW3.4: `stop` sets the event of the data directory.
func TestStopSignalsTheEvent(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("EQUORI_DATA_DIR", dir)

	name, err := windows.UTF16PtrFromString(stopEventName(dir))
	if err != nil {
		t.Fatal(err)
	}

	event, err := windows.CreateEvent(nil, 0, 0, name)
	if err != nil {
		t.Fatal(err)
	}

	defer func() { _ = windows.CloseHandle(event) }()

	done := make(chan error, 1)

	go func() { done <- runStop(nil) }()

	got, err := windows.WaitForSingleObject(event, 5000)
	if err != nil || got != windows.WAIT_OBJECT_0 {
		t.Fatalf("WaitForSingleObject = %d, %v, want WAIT_OBJECT_0", got, err)
	}

	if err := <-done; err != nil {
		t.Fatalf("runStop = %v, want nil", err)
	}
}
