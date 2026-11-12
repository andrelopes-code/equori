package feed

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestDownload(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/file" {
			_, _ = w.Write([]byte("abc"))

			return
		}

		http.NotFound(w, r)
	}))
	t.Cleanup(srv.Close)

	t.Run("passes the file and removes it", func(t *testing.T) {
		t.Parallel()

		var name string

		err := Download(
			t.Context(),
			srv.Client(),
			srv.URL+"/file",
			func(f *os.File, size int64) error {
				name = f.Name()

				body, err := io.ReadAll(f)
				if err != nil {
					return err
				}

				if size != 3 || string(body) != "abc" {
					t.Errorf("size %d, body %q", size, body)
				}

				return nil
			},
		)
		if err != nil {
			t.Fatal(err)
		}

		if _, err := os.Stat(name); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("stat %s = %v", name, err)
		}
	})

	t.Run("404 is ErrNoData", func(t *testing.T) {
		t.Parallel()

		called := false
		err := Download(t.Context(), srv.Client(), srv.URL+"/none", func(*os.File, int64) error {
			called = true

			return nil
		})

		if !errors.Is(err, ErrNoData) || called {
			t.Fatalf("err %v, called %v", err, called)
		}
	})

	t.Run("an answer over the limit fails", func(t *testing.T) {
		t.Parallel()

		var name string

		_, err := download(
			t.Context(),
			srv.Client(),
			srv.URL+"/file",
			"",
			2,
			func(f *os.File, _ int64) error {
				name = f.Name()

				return nil
			},
		)
		if err == nil || err.Error() != "answer over 2 bytes" {
			t.Fatalf("err = %v", err)
		}

		if name != "" {
			t.Fatalf("read called with %s", name)
		}
	})
}

const lastModified = "Mon, 09 Nov 2026 03:54:30 GMT"

func conditionalServer(t *testing.T) (*httptest.Server, *[]string) {
	t.Helper()

	var seen []string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		since := r.Header.Get("If-Modified-Since")
		seen = append(seen, since)

		if since == lastModified {
			w.WriteHeader(http.StatusNotModified)

			return
		}

		w.Header().Set("Last-Modified", lastModified)
		_, _ = w.Write([]byte("abc"))
	}))
	t.Cleanup(srv.Close)

	return srv, &seen
}

func TestGetSince(t *testing.T) {
	t.Parallel()

	srv, seen := conditionalServer(t)

	body, lm, err := GetSince(t.Context(), srv.Client(), srv.URL, "")
	if err != nil {
		t.Fatal(err)
	}

	if string(body) != "abc" || lm != lastModified {
		t.Fatalf("body %q, Last-Modified %q", body, lm)
	}

	_, _, err = GetSince(t.Context(), srv.Client(), srv.URL, lastModified)
	if !errors.Is(err, ErrNoData) {
		t.Fatalf("err = %v, want ErrNoData", err)
	}

	if len(*seen) != 2 || (*seen)[0] != "" || (*seen)[1] != lastModified {
		t.Fatalf("If-Modified-Since seen = %q", *seen)
	}
}

func TestDownloadSince(t *testing.T) {
	t.Parallel()

	srv, seen := conditionalServer(t)
	calls := 0
	read := func(*os.File, int64) error { calls++; return nil }

	lm, err := DownloadSince(t.Context(), srv.Client(), srv.URL, "", read)
	if err != nil {
		t.Fatal(err)
	}

	if lm != lastModified || calls != 1 {
		t.Fatalf("Last-Modified %q, read calls %d", lm, calls)
	}

	_, err = DownloadSince(t.Context(), srv.Client(), srv.URL, lastModified, read)
	if !errors.Is(err, ErrNoData) || calls != 1 {
		t.Fatalf("err = %v, read calls %d", err, calls)
	}

	if len(*seen) != 2 || (*seen)[0] != "" || (*seen)[1] != lastModified {
		t.Fatalf("If-Modified-Since seen = %q", *seen)
	}
}
