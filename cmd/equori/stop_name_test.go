package main

import (
	"strings"
	"testing"
)

// PW3.4: one folder maps to one event name, whatever the case or the trailing separator.
func TestStopEventName(t *testing.T) {
	t.Parallel()

	const prefix = `Local\equori-stop-`

	a := stopEventName(`C:\Users\Ana\AppData\Local\equori\data`)
	b := stopEventName(`c:\users\ana\appdata\local\equori\data\`)

	if a != b {
		t.Fatalf("same folder gives %q and %q", a, b)
	}

	if !strings.HasPrefix(a, prefix) || len(a) != len(prefix)+16 {
		t.Fatalf("name %q, want %q followed by 16 hex characters", a, prefix)
	}

	if stopEventName(`D:\equori\data`) == a {
		t.Fatal("two folders share a name")
	}
}
