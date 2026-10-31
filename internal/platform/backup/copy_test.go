package backup

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

func TestEncryptDecrypt(t *testing.T) {
	t.Parallel()

	src := filepath.Join(t.TempDir(), "periodic-2026-11-20-s1.dump")
	content := []byte("PGDMP row 'Zebra 4410'\n")

	if err := os.WriteFile(src, content, 0o600); err != nil {
		t.Fatal(err)
	}

	dir := t.TempDir()

	name, err := Encrypt(src, dir, "correct horse battery")
	if err != nil {
		t.Fatal(err)
	}

	if want := "periodic-2026-11-20-s1.dump.age"; name != want {
		t.Fatalf("name = %q, want %q", name, want)
	}

	copyPath := filepath.Join(dir, name)
	assertCopyMode(t, copyPath)

	partial, err := filepath.Glob(filepath.Join(dir, "*.partial"))
	if err != nil || len(partial) != 0 {
		t.Fatalf("partial files = %v, %v; want none", partial, err)
	}

	isCopy, err := IsCopy(copyPath)
	if err != nil || !isCopy {
		t.Fatalf("IsCopy(copy) = %v, %v; want true", isCopy, err)
	}

	isCopy, err = IsCopy(src)
	if err != nil || isCopy {
		t.Fatalf("IsCopy(dump) = %v, %v; want false", isCopy, err)
	}

	dst := filepath.Join(t.TempDir(), "restored.dump")
	if err := Decrypt(copyPath, dst, "correct horse battery"); err != nil {
		t.Fatal(err)
	}

	got, err := os.ReadFile(dst)
	if err != nil || !bytes.Equal(got, content) {
		t.Fatalf("decrypted = %q, %v; want %q", got, err, content)
	}

	assertPlaintextMode(t, dst)

	err = Decrypt(copyPath, filepath.Join(t.TempDir(), "wrong.dump"), "wrong password 1")
	if !errors.Is(err, ErrCopyPassword) {
		t.Fatalf("Decrypt with a wrong password = %v, want ErrCopyPassword", err)
	}
}

func TestEncryptMissingFolder(t *testing.T) {
	t.Parallel()

	src := filepath.Join(t.TempDir(), "periodic-2026-11-20-s1.dump")
	if err := os.WriteFile(src, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	_, err := Encrypt(src, filepath.Join(t.TempDir(), "missing"), "correct horse battery")
	if !errors.Is(err, ErrFolderNotWritable) {
		t.Fatalf("Encrypt into a missing folder = %v, want ErrFolderNotWritable", err)
	}
}

func TestPruneCopies(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()

	names := []string{"notes.txt"}
	for day := 1; day <= 8; day++ {
		names = append(names, fmt.Sprintf("periodic-2026-11-0%d-s1.dump.age", day))
	}

	for _, name := range names {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	if err := PruneCopies(dir, Periodic, 7); err != nil {
		t.Fatal(err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}

	var got []string
	for _, e := range entries {
		got = append(got, e.Name())
	}

	if want := slices.Delete(slices.Clone(names), 1, 2); !slices.Equal(sorted(got), sorted(want)) {
		t.Fatalf("files = %v, want %v", got, want)
	}
}

func sorted(names []string) []string {
	out := slices.Clone(names)
	slices.Sort(out)

	return out
}
