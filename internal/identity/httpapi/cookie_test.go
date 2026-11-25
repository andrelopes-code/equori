package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestCookieSecureFollowsOrigin(t *testing.T) {
	t.Parallel()

	expires := time.Unix(0, 0)

	for name, tc := range map[string]struct {
		secureCookies bool
		origin        string
		want          bool
	}{
		"page over https":                   {true, "https://equori.example.com", true},
		"page over http":                    {true, "http://192.168.1.10:8080", false},
		"no origin":                         {true, "", true},
		"opaque origin":                     {true, "null", true},
		"insecure cookies, page over https": {false, "https://equori.example.com", false},
		"insecure cookies, no origin":       {false, "", false},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			s := &Server{secureCookies: tc.secureCookies}

			r := httptest.NewRequestWithContext(
				t.Context(),
				http.MethodPost,
				"/api/v1/session",
				nil,
			)
			if tc.origin != "" {
				r.Header.Set("Origin", tc.origin)
			}

			for _, cookie := range []string{s.cookie(r, "v", expires), s.loginCookie(r, "v", expires)} {
				if got := strings.Contains(cookie, "; Secure"); got != tc.want {
					t.Errorf("Secure in %q = %t, want %t", cookie, got, tc.want)
				}
			}
		})
	}
}
