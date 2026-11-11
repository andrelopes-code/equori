package main

import (
	"context"
	"errors"

	"github.com/andrelopes-code/equori/internal/server"
)

var errUsage = errors.New("invalid arguments")

// withApp opens the database without serving, builds the application with an empty
// configuration and runs one subcommand on it.
func withApp(run func(ctx context.Context, app *server.App) error) error {
	cfg, log, err := setup()
	if err != nil {
		return err
	}

	ctx := context.Background()

	db, err := openDatabase(ctx, cfg, log, false)
	if err != nil {
		return err
	}
	defer db.Close(log)

	app, err := server.New(db.Pool, server.Config{}, log)
	if err != nil {
		return err
	}

	return run(ctx, app)
}
