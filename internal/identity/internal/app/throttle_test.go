package app

import (
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestThrottle(t *testing.T) {
	t.Parallel()
	start := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)
	th := newThrottle(3, 15*time.Minute)

	for i := range 3 {
		if !th.attempt("a", start.Add(time.Duration(i)*time.Minute)) {
			t.Fatalf("attempt %d refused within the limit", i+1)
		}
	}
	if th.attempt("a", start.Add(3*time.Minute)) {
		t.Fatal("attempt accepted beyond the limit")
	}
	if !th.attempt("b", start.Add(3*time.Minute)) {
		t.Fatal("limit of one key affects another key")
	}
	// The first attempt (t=0) leaves the window at t=15m.
	if !th.attempt("a", start.Add(15*time.Minute)) {
		t.Fatal("attempt refused after the oldest one left the window")
	}

	th.reset("a")
	if _, ok := th.attempts["a"]; ok {
		t.Fatal("reset kept attempts")
	}
}

func TestThrottleConcurrentAttempts(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)
	th := newThrottle(5, 15*time.Minute)
	var accepted atomic.Int32
	var wg sync.WaitGroup
	for range 100 {
		wg.Go(func() {
			if th.attempt("a", now) {
				accepted.Add(1)
			}
		})
	}
	wg.Wait()

	if got := accepted.Load(); got != 5 {
		t.Fatalf("accepted %d concurrent attempts, want 5", got)
	}
}

func TestThrottleSweepsStaleKeys(t *testing.T) {
	t.Parallel()
	start := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)
	th := newThrottle(5, time.Minute)
	for i := range maxThrottleKeys {
		th.attempt(strconv.Itoa(i), start)
	}

	th.attempt("new", start.Add(time.Hour))

	if len(th.attempts) != 1 {
		t.Fatalf("len(attempts) = %d, want 1 after sweep", len(th.attempts))
	}
}
