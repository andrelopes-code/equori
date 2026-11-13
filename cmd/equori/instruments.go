package main

import (
	"context"
	"fmt"
	"os"

	"github.com/andrelopes-code/equori/internal/server"
)

// instrumentsCommand lists the stored shares whose name says an ETF or a FII, and with --apply
// edits their type.
func instrumentsCommand(args []string) error {
	apply := len(args) == 2 && args[1] == "--apply"
	if len(args) == 0 || args[0] != "retype" || len(args) > 2 || (len(args) == 2 && !apply) {
		fmt.Fprintln(os.Stderr, "usage: equori instruments retype [--apply]")
		return errUsage
	}

	return withApp(func(ctx context.Context, app *server.App) error {
		fixes, err := app.Marketdata.SuggestTypeFixes(ctx)
		if err != nil {
			return err
		}

		for _, f := range fixes {
			fmt.Printf("%s\t%s -> %s\t%s\n", f.Code, f.From, f.To, f.Name)
		}

		if !apply {
			fmt.Printf("%d to change; run with --apply to edit them\n", len(fixes))
			return nil
		}

		if err := app.Marketdata.ApplyTypeFixes(ctx, fixes); err != nil {
			return err
		}

		fmt.Printf("%d changed\n", len(fixes))

		return nil
	})
}
