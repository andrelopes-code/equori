package main

import (
	"context"
	"fmt"
	"os"

	"github.com/andrelopes-code/equori/internal/server"
)

// reportingCommand rebuilds every derived balance series from the ledger.
func reportingCommand(args []string) error {
	if len(args) != 1 || args[0] != "rebuild" {
		fmt.Fprintln(os.Stderr, "usage: equori reporting rebuild")
		return errUsage
	}

	return withApp(func(ctx context.Context, app *server.App) error {
		return app.Reporting.RebuildAll(ctx)
	})
}
