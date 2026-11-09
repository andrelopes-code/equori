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

		err := Download(t.Context(), srv.Client(), srv.URL+"/file", func(f *os.File, size int64) error {
			name = f.Name()

			body, err := io.ReadAll(f)
			if err != nil {
				return err
			}

			if size != 3 || string(body) != "abc" {
				t.Errorf("size %d, body %q", size, body)
			}

			return nil
		})
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

		err := download(t.Context(), srv.Client(), srv.URL+"/file", 2, func(f *os.File, _ int64) error {
			name = f.Name()

			return nil
		})
		if err == nil || err.Error() != "answer over 2 bytes" {
			t.Fatalf("err = %v", err)
		}

		if name != "" {
			t.Fatalf("read called with %s", name)
		}
	})
}
