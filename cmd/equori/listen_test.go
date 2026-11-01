package main

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func TestS226ListenError(t *testing.T) {
	t.Parallel()

	ln, err := (&net.ListenConfig{}).Listen(t.Context(), "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}

	defer ln.Close()

	addr := ln.Addr().String()

	err = httpserver.Run(t.Context(), addr, http.NotFoundHandler(), slog.New(slog.DiscardHandler))
	if err == nil {
		t.Fatal("Run: nil error")
	}

	want := fmt.Sprintf(
		"EQUORI_HTTP_ADDR %q: %s; expected a free host:port; example: EQUORI_HTTP_ADDR=127.0.0.1:8081",
		addr,
		err,
	)
	if got := listenError(addr, err).Error(); got != want {
		t.Errorf("listenError = %q, want %q", got, want)
	}

	if got := listenError(addr, io.EOF); !errors.Is(got, io.EOF) {
		t.Errorf("listenError(io.EOF) = %v, want io.EOF", got)
	}
}
