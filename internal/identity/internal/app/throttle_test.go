package app

import (
	"strconv"
	"testing"
	"time"
)

func TestThrottle(t *testing.T) {
	start := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)
	th := newThrottle(3, 15*time.Minute)

	for i := range 3 {
		if !th.allowed("a", start) {
			t.Fatalf("blocked before failure %d", i+1)
		}
		th.fail("a", start.Add(time.Duration(i)*time.Minute))
	}
	if th.allowed("a", start.Add(3*time.Minute)) {
		t.Fatal("allowed after reaching the limit")
	}
	if !th.allowed("b", start.Add(3*time.Minute)) {
		t.Fatal("limit of one key affects another key")
	}
	// The first failure (t=0) leaves the window at t=15m.
	if !th.allowed("a", start.Add(15*time.Minute)) {
		t.Fatal("blocked after the oldest failure left the window")
	}

	th.reset("a")
	if _, ok := th.failures["a"]; ok {
		t.Fatal("reset kept failures")
	}
}

func TestThrottleSweepsStaleKeys(t *testing.T) {
	start := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)
	th := newThrottle(5, time.Minute)
	for i := range maxThrottleKeys {
		th.fail(strconv.Itoa(i), start)
	}

	th.fail("new", start.Add(time.Hour))

	if len(th.failures) != 1 {
		t.Fatalf("len(failures) = %d, want 1 after sweep", len(th.failures))
	}
}
