package main

import (
	"context"
	"fmt"
	"os"

	"github.com/andrelopes-code/equori/internal/server"
)

const rotateUsage = `usage: equori secrets rotate

Reseals every stored integration credential under EQUORI_SECRET_KEY. Set the new key in
EQUORI_SECRET_KEY and the old one in EQUORI_SECRET_KEY_PREVIOUS, run this command, then
remove EQUORI_SECRET_KEY_PREVIOUS (ADR 008).`

func secretsCommand(args []string) error {
	if len(args) != 1 || args[0] != "rotate" {
		fmt.Fprintln(os.Stderr, rotateUsage)
		return errUsage
	}
	cfg, log, err := setup()
	if err != nil {
		return err
	}
	ctx := context.Background()
	pool, err := openDatabase(ctx, cfg, log)
	if err != nil {
		return err
	}
	defer pool.Close()
	app, err := server.New(pool, serverConfig(cfg, nil), log)
	if err != nil {
		return err
	}
	n, err := app.Ingestion.RotateSecrets(ctx)
	if err != nil {
		return err
	}
	fmt.Printf("resealed %d credentials\n", n)
	// A separate transaction: no transaction spans modules (ADR 002).
	if n, err = app.Assistant.RotateSecrets(ctx); err != nil {
		return err
	}
	fmt.Printf("resealed %d language model keys\n", n)
	return nil
}
