package main

import (
	"fmt"
	"log/slog"
	"net"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/config"
)

func TestS225DatabaseConnectError(t *testing.T) {
	t.Parallel()

	ln, err := (&net.ListenConfig{}).Listen(t.Context(), "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}

	port := ln.Addr().(*net.TCPAddr).Port

	if err := ln.Close(); err != nil {
		t.Fatal(err)
	}

	cfg := config.Config{
		DatabaseURL: fmt.Sprintf("postgres://equori:s3cret@127.0.0.1:%d/equori_s225?sslmode=disable", port),
	}

	_, err = openDatabase(t.Context(), cfg, slog.New(slog.DiscardHandler), true)
	if err == nil {
		t.Fatal("openDatabase: nil error")
	}

	prefix := fmt.Sprintf(
		"cannot connect to the database of EQUORI_DATABASE_URL (host 127.0.0.1, port %d, database equori_s225): ",
		port,
	)
	if !strings.HasPrefix(err.Error(), prefix) {
		t.Errorf("error = %q, want prefix %q", err, prefix)
	}

	if strings.Contains(err.Error(), "s3cret") {
		t.Errorf("error %q holds the password", err)
	}
}
