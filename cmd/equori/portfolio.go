package main

import (
	"context"
	"fmt"
	"os"

	"github.com/andrelopes-code/equori/internal/server"
)

// portfolioCommand rebuilds every derived position, result and income event from the ledger.
func portfolioCommand(args []string) error {
	if len(args) != 1 || args[0] != "rebuild" {
		fmt.Fprintln(os.Stderr, "usage: equori portfolio rebuild")
		return errUsage
	}

	return withApp(func(ctx context.Context, app *server.App) error {
		return app.Portfolio.RebuildAll(ctx)
	})
}
