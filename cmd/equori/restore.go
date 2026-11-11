package main

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/andrelopes-code/equori/internal/platform/backup"
	"github.com/andrelopes-code/equori/internal/platform/config"
	"github.com/andrelopes-code/equori/internal/platform/pgcluster"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
)

func restoreCommand(args []string) error {
	if len(args) != 1 {
		fmt.Fprintln(os.Stderr, backupUsage)
		return errUsage
	}

	file := args[0]

	cfg, _, err := setup()
	if err != nil {
		return err
	}

	ctx := context.Background()

	latest, err := postgres.LatestVersion()
	if err != nil {
		return err
	}

	bin, err := pgcluster.Bin(cfg.PostgresBin)
	if err != nil {
		return err
	}

	file, cleanup, err := plainDump(file)
	if err != nil {
		return err
	}

	defer cleanup()

	return runRestore(ctx, cfg, bin, file, latest)
}

func runRestore(
	ctx context.Context,
	cfg config.Config,
	bin string,
	file string,
	latest int64,
) error {
	// Restore never calls openDatabase, which would migrate before the drop.
	if cfg.Managed() {
		c, err := pgcluster.Attach(ctx, cfg.DataDir, bin)
		if err != nil {
			return err
		}

		if !c.Owned() {
			_ = c.Stop()

			return errors.New("equori serve is running on this data directory; " +
				"stop it, then run equori restore again")
		}

		defer func() { _ = c.Stop() }()

		err = backup.Restore(ctx, c.Bin(), c.DSN(pgcluster.Database), file, latest)
		if err != nil {
			return err
		}
	} else if err := backup.Restore(ctx, bin, cfg.DatabaseURL, file, latest); err != nil {
		return err
	}

	fmt.Printf("restored %s; the next start applies newer migrations\n", file)

	return nil
}

// plainDump returns file when it is a dump. For an encrypted copy it returns a decrypted
// temporary file, which cleanup removes.
func plainDump(file string) (string, func(), error) {
	isCopy, err := backup.IsCopy(file)
	if err != nil {
		return "", nil, err
	}

	if !isCopy {
		return file, func() {}, nil
	}

	password, err := readPassword()
	if err != nil {
		return "", nil, err
	}

	tmp, err := os.CreateTemp("", "equori-restore-*.dump")
	if err != nil {
		return "", nil, fmt.Errorf("create temporary dump: %w", err)
	}

	cleanup := func() { _ = os.Remove(tmp.Name()) }

	if err := tmp.Close(); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("close temporary dump: %w", err)
	}

	if err := backup.Decrypt(file, tmp.Name(), password); err != nil {
		cleanup()
		return "", nil, err
	}

	return tmp.Name(), cleanup, nil
}
