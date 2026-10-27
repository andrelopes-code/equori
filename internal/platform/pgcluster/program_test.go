package pgcluster

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseMajor(t *testing.T) {
	t.Parallel()
	tests := []struct {
		out  string
		want int
		err  bool
	}{
		{out: "postgres (PostgreSQL) 18.6\n", want: 18},
		{out: "pg_dump (PostgreSQL) 18.6 (Debian 18.6-1.pgdg13+1)\n", want: 18},
		{out: "postgres (PostgreSQL) 19beta3\n", want: 19},
		{out: "something else\n", err: true},
	}
	for _, tt := range tests {
		got, err := parseMajor(tt.out)
		if (err != nil) != tt.err || got != tt.want {
			t.Errorf("parseMajor(%q) = %d, %v; want %d, error %v", tt.out, got, err, tt.want, tt.err)
		}
	}
}

func TestBinExplicit(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "postgres"), []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	if got, err := Bin(dir); err != nil || got != dir {
		t.Fatalf("Bin(%q) = %q, %v", dir, got, err)
	}
	if _, err := Bin(t.TempDir()); err == nil {
		t.Fatal("Bin of a directory without postgres: want an error")
	}
}

func TestBinFromPath(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "postgres"), []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir)
	if got, err := Bin(""); err != nil || got != dir {
		t.Fatalf(`Bin("") = %q, %v; want %q`, got, err, dir)
	}
}

func TestBinBesideExecutable(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "postgresql", "bin")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "postgres"), []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", t.TempDir())
	if got, err := bin("", filepath.Join(root, "equori")); err != nil || got != dir {
		t.Fatalf(`bin("", exe) = %q, %v; want %q`, got, err, dir)
	}
}

func TestBinExplicitWins(t *testing.T) {
	root := t.TempDir()
	beside := filepath.Join(root, "postgresql", "bin")
	explicit := t.TempDir()
	for _, dir := range []string{beside, explicit} {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "postgres"), []byte("#!/bin/sh\n"), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	if got, err := bin(explicit, filepath.Join(root, "equori")); err != nil || got != explicit {
		t.Fatalf("bin(explicit, exe) = %q, %v; want %q", got, err, explicit)
	}
}
