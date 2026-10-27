// Package backup writes and restores pg_dump archives of the database (ADR 022, D4).
package backup

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/platform/pgcluster"
)

var (
	ErrDumpAhead  = errors.New("the dump holds a migration this binary does not know")
	ErrOldProgram = errors.New("pg_dump is older than the server")
	ErrNoCreateDB = errors.New("restore recreates the database and needs a role that may create one")
)

// Dump writes pg_dump's custom format of the database to path, created with mode 0600 (B1).
func Dump(ctx context.Context, bin, dsn, path string) error {
	program := filepath.Join(bin, "pg_dump")
	client, err := pgcluster.Major(ctx, program)
	if err != nil {
		return err
	}
	server, err := serverMajor(ctx, dsn)
	if err != nil {
		return err
	}
	if client < server {
		return fmt.Errorf("%w: pg_dump %d, server %d", ErrOldProgram, client, server)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create backup directory: %w", err)
	}
	partial := path + ".partial"
	// A dump killed mid-way leaves its partial file; the next run of the same name replaces it.
	if err := os.Remove(partial); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("remove %s: %w", partial, err)
	}
	f, err := os.OpenFile(partial, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600) //nolint:gosec // G304: the backup path is the owner's configuration.
	if err != nil {
		return fmt.Errorf("create %s: %w", partial, err)
	}
	var stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, program, "-Fc", "-d", dsn) //nolint:gosec // G204: the programs directory is the owner's configuration.
	cmd.Stdout, cmd.Stderr = f, &stderr
	err = cmd.Run()
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(partial)
		return fmt.Errorf("pg_dump: %w: %s", err, stderr.String())
	}
	if err := os.Rename(partial, path); err != nil {
		return fmt.Errorf("finish %s: %w", path, err)
	}
	return nil
}

func serverMajor(ctx context.Context, dsn string) (int, error) {
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return 0, fmt.Errorf("connect: %w", err)
	}
	defer func() { _ = conn.Close(ctx) }()
	var num int
	if err := conn.QueryRow(ctx, "SELECT current_setting('server_version_num')::int").Scan(&num); err != nil {
		return 0, fmt.Errorf("read server version: %w", err)
	}
	return num / 10000, nil
}

// DumpVersion reads the highest goose version from the dump's copy of goose_db_version.
func DumpVersion(ctx context.Context, bin, path string) (int64, error) {
	out, err := exec.CommandContext(ctx, filepath.Join(bin, "pg_restore"), "--data-only", "--table=goose_db_version", "-f", "-", path).Output() //nolint:gosec // G204: as above.
	if err != nil {
		return 0, fmt.Errorf("read goose_db_version of %s: %w", path, err)
	}
	return parseDumpVersion(string(out))
}

func parseDumpVersion(script string) (int64, error) {
	var latest int64
	in, found := false, false
	for line := range strings.Lines(script) {
		line = strings.TrimRight(line, "\r\n")
		switch {
		case strings.HasPrefix(line, "COPY public.goose_db_version "):
			in, found = true, true
		case in && line == `\.`:
			in = false
		case in:
			fields := strings.Split(line, "\t")
			if len(fields) < 2 {
				return 0, fmt.Errorf("goose_db_version row %q: want at least 2 columns", line)
			}
			v, err := strconv.ParseInt(fields[1], 10, 64)
			if err != nil {
				return 0, fmt.Errorf("goose_db_version row %q: %w", line, err)
			}
			latest = max(latest, v)
		}
	}
	if !found {
		return 0, errors.New("the dump holds no goose_db_version data")
	}
	return latest, nil
}

// Restore replaces the database named in dsn with the dump (B2). The database is recreated with
// the builtin C.UTF-8 provider, so text order does not depend on the host that receives it.
func Restore(ctx context.Context, bin, dsn, path string, latest int64) error {
	v, err := DumpVersion(ctx, bin, path)
	if err != nil {
		return err
	}
	if v > latest {
		return fmt.Errorf("%w: dump at version %d, this binary knows up to %d", ErrDumpAhead, v, latest)
	}
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("parse connection string: %w", err)
	}
	name := pgx.Identifier{cfg.Database}.Sanitize()
	cfg.Database = "postgres"
	conn, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		return fmt.Errorf("connect to the maintenance database: %w", err)
	}
	defer func() { _ = conn.Close(ctx) }()
	// The drop comes before the create: a role that may drop its database but not create one would
	// lose it, so the privilege is checked first.
	var create bool
	if err := conn.QueryRow(ctx, "SELECT rolcreatedb OR rolsuper FROM pg_roles WHERE rolname = current_user").Scan(&create); err != nil {
		return fmt.Errorf("read role privileges: %w", err)
	}
	if !create {
		return fmt.Errorf("%w: role %s lacks CREATEDB", ErrNoCreateDB, cfg.User)
	}
	if _, err := conn.Exec(ctx, "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)"); err != nil {
		return fmt.Errorf("drop database: %w", err)
	}
	if _, err := conn.Exec(ctx, "CREATE DATABASE "+name+" TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER builtin BUILTIN_LOCALE 'C.UTF-8'"); err != nil {
		return fmt.Errorf("create database: %w", err)
	}
	out, err := exec.CommandContext(ctx, filepath.Join(bin, "pg_restore"), "--no-owner", "--exit-on-error", "-d", dsn, path).CombinedOutput() //nolint:gosec // G204: as above.
	if err != nil {
		return fmt.Errorf("pg_restore: %w: %s", err, out)
	}
	return nil
}
