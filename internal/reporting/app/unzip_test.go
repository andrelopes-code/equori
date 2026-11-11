package app

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"testing"
)

// A small archive of many compressible entries cannot expand past the total bound.
func TestUnzipBoundsTheTotalExpansion(t *testing.T) {
	t.Parallel()
	const entry, count, limit = 8 << 20, 64, 32 << 20

	var buf bytes.Buffer

	w := zip.NewWriter(&buf)
	for i := range count {
		f, err := w.Create(fmt.Sprintf("part-%d.json", i))
		if err != nil {
			t.Fatal(err)
		}

		if _, err := f.Write(make([]byte, entry)); err != nil {
			t.Fatal(err)
		}
	}

	if err := w.Close(); err != nil {
		t.Fatal(err)
	}

	_, err := unzip(buf.Bytes(), limit)
	if !errors.Is(err, ErrArchiveInvalid) {
		t.Fatalf("err = %v, want ErrArchiveInvalid", err)
	}
}
