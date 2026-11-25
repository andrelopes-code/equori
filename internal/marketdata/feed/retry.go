package feed

import (
	"net/http"
	"time"
)

// Retrying returns a copy of c that repeats a request answered with a transient status up to four
// times, after 1, 2, 4 and 8 seconds, within the timeout of c. It serves requests without a body.
func Retrying(c *http.Client) *http.Client {
	next := c.Transport
	if next == nil {
		next = http.DefaultTransport
	}

	out := *c
	out.Transport = retryTransport{next: next}

	return &out
}

type retryTransport struct{ next http.RoundTripper }

func (t retryTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	for pause := time.Second; ; pause *= 2 {
		resp, err := t.next.RoundTrip(r)
		if err != nil || !transient(resp.StatusCode) || pause > 8*time.Second {
			return resp, err
		}

		_ = resp.Body.Close()

		select {
		case <-r.Context().Done():
			return nil, r.Context().Err()
		case <-time.After(pause):
		}
	}
}

func transient(status int) bool {
	switch status {
	case http.StatusInternalServerError,
		http.StatusBadGateway,
		http.StatusServiceUnavailable,
		http.StatusGatewayTimeout:
		return true
	}

	return false
}
