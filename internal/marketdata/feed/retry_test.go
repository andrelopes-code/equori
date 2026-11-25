package feed_test

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"testing/synctest"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
)

func TestRetrying(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		statuses []int
		want     int
		requests int
		waited   time.Duration
	}{
		{"success", []int{200}, 0, 1, 0},
		{"internal error once", []int{500, 200}, 0, 2, time.Second},
		{"gateway timeout once", []int{504, 200}, 0, 2, time.Second},
		{"each transient status", []int{500, 502, 503, 504, 200}, 0, 5, 15 * time.Second},
		{"still failing", []int{500, 500, 500, 500, 504}, 504, 5, 15 * time.Second},
		{"bad request", []int{400}, 400, 1, 0},
		{"rate limited", []int{429}, 429, 1, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			synctest.Test(t, func(t *testing.T) {
				answers := &scripted{statuses: tt.statuses}
				start := time.Now()

				_, err := feed.Get(t.Context(), answers.client(), "http://source.test/")

				var status *feed.StatusError

				got := 0
				if errors.As(err, &status) {
					got = status.Code
				} else if err != nil {
					t.Fatal(err)
				}

				if got != tt.want || answers.requests != tt.requests {
					t.Errorf("status %d after %d requests, want %d after %d",
						got, answers.requests, tt.want, tt.requests)
				}

				if waited := time.Since(start); waited != tt.waited {
					t.Errorf("waited %s, want %s", waited, tt.waited)
				}
			})
		})
	}
}

func TestRetryingEndsWithItsContext(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		answers := &scripted{statuses: []int{500, 500, 200}}

		ctx, cancel := context.WithTimeout(t.Context(), 2*time.Second)
		defer cancel()

		_, err := feed.Get(ctx, answers.client(), "http://source.test/")

		if err == nil || answers.requests != 2 {
			t.Errorf("error %v after %d requests, want one after 2", err, answers.requests)
		}
	})
}

// scripted answers each request with the next status.
type scripted struct {
	statuses []int
	requests int
}

func (s *scripted) client() *http.Client { return feed.Retrying(&http.Client{Transport: s}) }

func (s *scripted) RoundTrip(r *http.Request) (*http.Response, error) {
	status := s.statuses[s.requests]
	s.requests++

	return &http.Response{
		StatusCode: status,
		Header:     http.Header{},
		Body:       io.NopCloser(strings.NewReader("")),
		Request:    r,
	}, nil
}
