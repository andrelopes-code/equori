package marketdata

import (
	"net/http"
	"time"
)

// FeedClient returns the HTTP client of every feed: a one-minute timeout and the header
// User-Agent equori/<version> (A222 MQ18).
func FeedClient(version string) *http.Client {
	return &http.Client{
		Timeout:   time.Minute,
		Transport: userAgentTransport{next: http.DefaultTransport, agent: "equori/" + version},
	}
}

type userAgentTransport struct {
	next  http.RoundTripper
	agent string
}

func (t userAgentTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	r = r.Clone(r.Context())
	r.Header.Set("User-Agent", t.agent)

	return t.next.RoundTrip(r)
}
