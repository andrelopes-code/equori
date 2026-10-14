package app

import (
	"sync"
	"time"
)

// maxThrottleKeys triggers a full sweep of stale entries, which bounds memory
// when an attacker submits many distinct emails.
const maxThrottleKeys = 10_000

// throttle counts failed logins per key inside a sliding window. State is in
// memory: it resets on restart and is not shared between instances (ADR 002: one instance).
type throttle struct {
	mu       sync.Mutex
	limit    int
	window   time.Duration
	failures map[string][]time.Time
}

func newThrottle(limit int, window time.Duration) *throttle {
	return &throttle{limit: limit, window: window, failures: make(map[string][]time.Time)}
}

func (t *throttle) allowed(key string, now time.Time) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return len(t.recent(key, now)) < t.limit
}

func (t *throttle) fail(key string, now time.Time) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if len(t.failures) >= maxThrottleKeys {
		for k := range t.failures {
			t.recent(k, now)
		}
	}
	t.failures[key] = append(t.recent(key, now), now)
}

func (t *throttle) reset(key string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.failures, key)
}

// recent drops failures older than the window and returns the rest. Callers hold mu.
func (t *throttle) recent(key string, now time.Time) []time.Time {
	times := t.failures[key]
	i := 0
	for i < len(times) && now.Sub(times[i]) >= t.window {
		i++
	}
	if i == len(times) {
		delete(t.failures, key)
		return nil
	}
	t.failures[key] = times[i:]
	return times[i:]
}
