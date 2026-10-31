package server

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ingestion"
	"github.com/andrelopes-code/equori/internal/instance"
)

// connections adapts the ingestion read of the diagnostic file to the instance module (ADR 002).
func connections(in *ingestion.Module) func(context.Context) ([]instance.Connection, error) {
	return func(ctx context.Context) ([]instance.Connection, error) {
		list, err := in.ConnectionDiagnostics(ctx)
		if err != nil {
			return nil, err
		}

		out := make([]instance.Connection, len(list))
		for i, c := range list {
			out[i] = instance.Connection{
				ID: c.ID, Aggregator: c.Aggregator, State: c.State, LastUpdate: c.LastUpdate, Failed: c.Failed,
			}
		}

		return out, nil
	}
}
