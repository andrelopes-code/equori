package pgcluster

import (
	"errors"
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

func TestRefuseRoot(t *testing.T) {
	t.Parallel()
	if !errors.Is(refuseRoot(0), ErrRoot) || refuseRoot(1000) != nil {
		t.Fatal("refuseRoot: want ErrRoot for 0 and nil for 1000")
	}
}
