package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
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
In managed mode, restore refuses to run while equori serve runs.`

// runPeriodicBackups writes a periodic backup when the newest is 24 hours old, checked every hour (B3).
func runPeriodicBackups(ctx context.Context, db *database, cfg config.Config, log *slog.Logger) {
	tick := time.NewTicker(time.Hour)
	defer tick.Stop()
	for {
		if due, err := backup.Due(cfg.BackupDir, time.Now(), 24*time.Hour); err != nil {
			log.Error("periodic backup", "error", err)
		} else if due {
			latest, _ := postgres.LatestVersion()
			path := filepath.Join(cfg.BackupDir, backup.Name(backup.Periodic, time.Now().In(cfg.TimeZone), latest))
			if err := backup.Dump(ctx, db.Cluster.Bin(), db.DSN, path); err != nil {
				log.Error("periodic backup", "error", err)
			} else if err := backup.Prune(cfg.BackupDir, backup.Periodic, 7); err != nil {
				log.Error("prune periodic backups", "error", err)
			} else {
				log.Info("periodic backup", "path", path)
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

func backupCommand(args []string) error {
	fs := flag.NewFlagSet("backup", flag.ContinueOnError)
	out := fs.String("out", "", "file to write; default the backup directory in managed mode, the current directory otherwise")
	if err := fs.Parse(args); err != nil || fs.NArg() != 0 {
		fmt.Fprintln(os.Stderr, backupUsage)
		return errUsage
	}
	cfg, _, err := setup()
	if err != nil {
		return err
	}
	ctx := context.Background()
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
	path := *out
	if path == "" {
		path = backup.Name(backup.Manual, time.Now().In(cfg.TimeZone), latest)
		if cfg.Managed() {
			path = filepath.Join(cfg.BackupDir, path)
		}
	}
	if err := backup.Dump(ctx, bin, dsn, path); err != nil {
		return err
	}
	fmt.Println(path)
	fmt.Fprintln(os.Stderr, "the dump holds no secret key; equori secrets key prints the key in use")
	return nil
}

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
	// Restore never calls openDatabase, which would migrate before the drop.
	if cfg.Managed() {
		c, err := pgcluster.Attach(ctx, cfg.DataDir, bin)
		if err != nil {
			return err
		}
		if !c.Owned() {
			_ = c.Stop()
			return errors.New("equori serve is running on this data directory; stop it, then run equori restore again")
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
