package main

import (
	"context"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/config"
)

// healthcheck backs the container HEALTHCHECK: the distroless image has no curl.
//
//nolint:gosec // G704: host is fixed to 127.0.0.1; only the port comes from EQUORI_HTTP_ADDR.
func healthcheck() int {
	cfg, err := config.Load(os.Getenv, config.Families{})
	if err != nil {
		return 1
	}

	_, port, err := net.SplitHostPort(cfg.HTTPAddr)
	if err != nil {
		return 1
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		"http://"+net.JoinHostPort("127.0.0.1", port)+"/healthz",
		nil,
	)
	if err != nil {
		return 1
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 1
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 1
	}

	return 0
}
