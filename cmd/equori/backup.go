package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/backup"
	"github.com/andrelopes-code/equori/internal/platform/config"
	"github.com/andrelopes-code/equori/internal/platform/pgcluster"
	"github.com/andrelopes-code/equori/internal/platform/postgres"
)

const backupUsage = `usage: equori backup [--out FILE]
       equori restore FILE

backup writes a pg_dump archive; restore replaces the database with one.
restore also accepts an encrypted copy (.age) and reads its password from stdin.
In managed mode, restore refuses to run while equori serve runs.`

func backupCommand(args []string) error {
	out, err := parseBackupFlags(args)
	if err != nil {
		return err
	}

	cfg, _, err := setup()
	if err != nil {
		return err
	}

	return runBackup(context.Background(), cfg, out)
}

// parseBackupFlags returns the --out value; no positional argument is allowed.
func parseBackupFlags(args []string) (string, error) {
	fs := flag.NewFlagSet("backup", flag.ContinueOnError)

	out := fs.String(
		"out",
		"",
		"file to write; default EQUORI_BACKUP_DIR when set, the current directory otherwise",
	)
	if err := fs.Parse(args); err != nil || fs.NArg() != 0 {
		fmt.Fprintln(os.Stderr, backupUsage)
		return "", errUsage
	}

	return *out, nil
}

func runBackup(ctx context.Context, cfg config.Config, out string) error {
	bin, err := pgcluster.Bin(cfg.PostgresBin)
	if err != nil {
		return err
	}

	// A backup holds the database as it is, so it never goes through openDatabase, which migrates.
	dsn := cfg.DatabaseURL
	if cfg.Managed() {
		c, err := pgcluster.Attach(ctx, cfg.DataDir, bin)
		if err != nil {
			return err
		}

		defer func() { _ = c.Stop() }()

		dsn = c.DSN(pgcluster.Database)
	}

	latest, err := postgres.LatestVersion()
	if err != nil {
		return err
	}

	path := backupPath(cfg, out, latest)
	if err := backup.Dump(ctx, bin, dsn, path); err != nil {
		return err
	}

	fmt.Println(path)
	fmt.Fprintln(
		os.Stderr,
		"the dump holds no secret key; equori secrets key prints the key in use",
	)

	return nil
}

// backupPath returns out, or a generated name under EQUORI_BACKUP_DIR when set.
func backupPath(cfg config.Config, out string, latest int64) string {
	path := out
	if path == "" {
		path = backup.Name(backup.Manual, time.Now().UTC(), latest)
		if cfg.BackupDir != "" {
			path = filepath.Join(cfg.BackupDir, path)
		}
	}

	return path
}
