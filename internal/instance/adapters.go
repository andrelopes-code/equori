package instance

import (
	"context"

	"github.com/andrelopes-code/equori/internal/instance/app"
	"github.com/andrelopes-code/equori/internal/instance/domain"
	"github.com/andrelopes-code/equori/internal/platform/secret"
)

// connections adapts the server's read to the domain type; nil stays nil.
func connections(
	read func(ctx context.Context) ([]Connection, error),
) func(ctx context.Context) ([]domain.Connection, error) {
	if read == nil {
		return nil
	}

	return func(ctx context.Context) ([]domain.Connection, error) {
		list, err := read(ctx)
		if err != nil {
			return nil, err
		}

		out := make([]domain.Connection, len(list))
		for i, c := range list {
			out[i] = domain.Connection(c)
		}

		return out, nil
	}
}

// newSealer returns a nil interface, not a nil *secret.Box, without a secret key.
func newSealer(cfg Config) (app.Sealer, error) {
	if cfg.SecretKey == "" {
		return nil, nil //nolint:nilnil // no key means no sealer; the service checks for nil.
	}

	var previous []byte
	if cfg.PreviousSecretKey != "" {
		previous = []byte(cfg.PreviousSecretKey)
	}

	return secret.New([]byte(cfg.SecretKey), previous)
}
