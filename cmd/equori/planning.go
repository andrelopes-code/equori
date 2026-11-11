package main

import (
	"context"
	"fmt"
	"os"

	"github.com/andrelopes-code/equori/internal/server"
)

// planningCommand generates the occurrences schedules created before P7 amendment A127 lack.
func planningCommand(args []string) error {
	if len(args) != 1 || args[0] != "backfill" {
		fmt.Fprintln(os.Stderr, "usage: equori planning backfill")
		return errUsage
	}

	return withApp(func(ctx context.Context, app *server.App) error {
		return app.Planning.Backfill(ctx)
	})
}
