package app

import (
	"sync"
	"time"
)

// maxThrottleKeys triggers a full sweep of stale entries, which bounds memory
// when an attacker submits many distinct emails.
const maxThrottleKeys = 10_000

// throttle counts login attempts per key inside a sliding window. State is in
// memory: it resets on restart and is not shared between instances (ADR 002: one instance).
type throttle struct {
	mu       sync.Mutex
	limit    int
	window   time.Duration
	attempts map[string][]time.Time
}

func newThrottle(limit int, window time.Duration) *throttle {
	return &throttle{limit: limit, window: window, attempts: make(map[string][]time.Time)}
}

// attempt records an attempt and reports whether it is within the limit. Checking
// and recording happen under one lock, so concurrent requests cannot exceed the limit.
func (t *throttle) attempt(key string, now time.Time) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	if len(t.attempts) >= maxThrottleKeys {
		for k := range t.attempts {
			t.recent(k, now)
		}
	}
	recent := t.recent(key, now)
	if len(recent) >= t.limit {
		return false
	}
	t.attempts[key] = append(recent, now)
	return true
}

// reset clears the key after a successful login.
func (t *throttle) reset(key string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.attempts, key)
}

// recent drops attempts older than the window and returns the rest. Callers hold mu.
func (t *throttle) recent(key string, now time.Time) []time.Time {
	times := t.attempts[key]
	i := 0
	for i < len(times) && now.Sub(times[i]) >= t.window {
		i++
	}
	if i == len(times) {
		delete(t.attempts, key)
		return nil
	}
	t.attempts[key] = times[i:]
	return times[i:]
}
