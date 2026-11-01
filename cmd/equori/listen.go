package main

import (
	"errors"
	"fmt"
	"net"

	"github.com/andrelopes-code/equori/internal/platform/config"
)

// listenError names EQUORI_HTTP_ADDR when serve cannot listen on it (A161.6); any other error
// returns unchanged.
func listenError(addr string, err error) error {
	if opErr, ok := errors.AsType[*net.OpError](err); !ok || opErr.Op != "listen" {
		return err
	}

	v, _ := config.Lookup("EQUORI_HTTP_ADDR")

	return fmt.Errorf(
		"EQUORI_HTTP_ADDR %q: %w; expected a free host:port; example: EQUORI_HTTP_ADDR=%s",
		addr,
		err,
		v.Example,
	)
}
