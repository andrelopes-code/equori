//go:build unix

package pgcluster

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
)

const (
	Database = "equori"
	role     = "equori"
	stopWait = 60 * time.Second
	// The pool of serve holds at most max(4, CPUs) connections plus the dispatcher's; commands
	// beside serve open their own.
	maxConnections = "50"
)

var (
	ErrBusy          = errors.New("another equori process manages this data directory")
	ErrMajorMismatch = errors.New("the PostgreSQL major differs from the data directory's")
)

type Cluster struct {
	dir, bin, socket string
	lock             *os.File // nil when attached to the server of a running serve
	cmd              *exec.Cmd
	proc             *proc
	done             chan struct{} // closed when the child exits; nil when attached
	exitErr          error
}

func (c *Cluster) Bin() string             { return c.bin }
func (c *Cluster) Owned() bool             { return c.cmd != nil }
func (c *Cluster) Exited() <-chan struct{} { return c.done }
func (c *Cluster) ExitErr() error          { return c.exitErr }

// DSN is a keyword connection string read by pgx and by libpq programs alike.
func (c *Cluster) DSN(database string) string {
	return fmt.Sprintf("host=%s user=%s dbname=%s sslmode=disable", quote(c.socket), role, database)
}

func quote(v string) string {
	return "'" + strings.NewReplacer(`\`, `\\`, `'`, `\'`).Replace(v) + "'"
}

// Start runs the server of serve (M6): it takes the directory's lock, creates the cluster on the
// first run, stops a server left by a process that died, and starts postgres as a child.
func Start(ctx context.Context, dir, bin string) (*Cluster, error) {
	if err := checkPrivileges(); err != nil {
		return nil, err
	}
	lock, err := lockDir(dir)
	if err != nil {
		return nil, err
	}
	c, err := start(ctx, dir, bin, lock)
	if err != nil {
		_ = lock.Close()
		return nil, err
	}
	return c, nil
}

// Attach serves a command other than serve (M7): it connects to serve's server when serve holds
// the lock, and otherwise starts a temporary server that Stop ends.
func Attach(ctx context.Context, dir, bin string) (*Cluster, error) {
	if err := checkPrivileges(); err != nil {
		return nil, err
	}
	lock, err := lockDir(dir)
	if errors.Is(err, ErrBusy) {
		socket, err := socketDir(dir)
		if err != nil {
			return nil, err
		}
		c := &Cluster{dir: dir, bin: bin, socket: socket}
		conn, err := pgx.Connect(ctx, c.DSN(Database))
		if err != nil {
			return nil, fmt.Errorf("connect to the server of equori serve: %w", err)
		}
		_ = conn.Close(ctx)
		return c, nil
	}
	if err != nil {
		return nil, err
	}
	c, err := start(ctx, dir, bin, lock)
	if err != nil {
		_ = lock.Close()
		return nil, err
	}
	return c, nil
}

func lockDir(dir string) (*os.File, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("create data directory: %w", err)
	}
	f, err := os.OpenFile(filepath.Join(dir, "equori.lock"), os.O_CREATE|os.O_RDWR, 0o600) //nolint:gosec // G304: the data directory is the owner's configuration.
	if err != nil {
		return nil, fmt.Errorf("open lock: %w", err)
	}
	if err := lockFile(f); err != nil {
		_ = f.Close()
		return nil, err
	}
	return f, nil
}

func start(ctx context.Context, dir, bin string, lock *os.File) (*Cluster, error) {
	socket, err := socketDir(dir)
	if err != nil {
		return nil, err
	}
	if err := privateDir(socket); err != nil {
		return nil, err
	}
	major, err := Major(ctx, filepath.Join(bin, "postgres"))
	if err != nil {
		return nil, err
	}
	if major < postgres.MinMajor {
		return nil, fmt.Errorf("PostgreSQL %d is older than %d, the oldest the migrations run on", major, postgres.MinMajor)
	}
	pgdata := filepath.Join(dir, "pg")
	if err := initialize(ctx, bin, pgdata, major); err != nil {
		return nil, err
	}
	if err := stopLeftover(ctx, bin, pgdata, socket); err != nil {
		return nil, err
	}
	// Not CommandContext: the server outlives the start context and stops in Stop, after HTTP.
	cmd := exec.Command(filepath.Join(bin, "postgres"), "-D", pgdata, "-k", socket, //nolint:gosec,noctx // G204: the programs directory is the owner's configuration.
		"-c", "listen_addresses=", "-c", "max_connections="+maxConnections)
	cmd.Stdout, cmd.Stderr = os.Stderr, os.Stderr
	p, err := newProc(cmd)
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		p.close()
		return nil, fmt.Errorf("start postgres: %w", err)
	}
	c := &Cluster{dir: dir, bin: bin, socket: socket, lock: lock, cmd: cmd, proc: p, done: make(chan struct{})}
	go func() {
		c.exitErr = cmd.Wait()
		close(c.done)
	}()
	if err := p.started(cmd); err != nil {
		_ = c.stopChild()
		return nil, err
	}
	if err := c.waitReady(ctx); err != nil {
		_ = c.stopChild()
		return nil, err
	}
	if err := c.ensureDatabase(ctx); err != nil {
		_ = c.stopChild()
		return nil, err
	}
	return c, nil
}

func initialize(ctx context.Context, bin, pgdata string, major int) error {
	b, err := os.ReadFile(filepath.Join(pgdata, "PG_VERSION")) //nolint:gosec // G304: as above.
	if err == nil {
		have, err := strconv.Atoi(strings.TrimSpace(string(b)))
		if err != nil {
			return fmt.Errorf("read PG_VERSION: %w", err)
		}
		if have != major {
			return fmt.Errorf("%w: data directory %d, programs %d; see the upgrade design of the release that changed the major", ErrMajorMismatch, have, major)
		}
		return nil
	}
	if !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("read PG_VERSION: %w", err)
	}
	out, err := exec.CommandContext(ctx, filepath.Join(bin, "initdb"), "-D", pgdata, "-U", role, //nolint:gosec // G204: as above.
		"--encoding=UTF8", "--locale=C", "--locale-provider=builtin", "--builtin-locale=C.UTF-8", "--auth=trust").CombinedOutput()
	if err != nil {
		return fmt.Errorf("initdb: %w: %s", err, out)
	}
	// M5: one local line; access control is the mode of the socket directory.
	return os.WriteFile(filepath.Join(pgdata, "pg_hba.conf"), []byte("local all all trust\n"), 0o600)
}

func stopLeftover(ctx context.Context, bin, pgdata, socket string) error {
	pidFile := filepath.Join(pgdata, "postmaster.pid")
	if _, err := os.Stat(pidFile); errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if !answers(ctx, socket) {
		// Stale: this process holds equori.lock and no server answers on the socket. After a container
		// restart the file's PID names another process, and postgres would refuse to start beside it.
		for _, name := range []string{pidFile, filepath.Join(socket, ".s.PGSQL.5432.lock")} {
			if err := os.Remove(name); err != nil && !errors.Is(err, fs.ErrNotExist) {
				return fmt.Errorf("remove stale %s: %w", name, err)
			}
		}
		return nil
	}
	out, err := exec.CommandContext(ctx, filepath.Join(bin, "pg_ctl"), "stop", "-D", pgdata, "-m", "fast", "-w", "-t", "60").CombinedOutput() //nolint:gosec // G204: as above.
	if err != nil {
		return fmt.Errorf("stop the server left running: %w: %s", err, out)
	}
	return nil
}

// answers reports whether a server listens on the socket; a server that is starting or stopping
// answers with an error, which counts.
func answers(ctx context.Context, socket string) bool {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	conn, err := pgx.Connect(ctx, (&Cluster{socket: socket}).DSN("postgres"))
	if err == nil {
		_ = conn.Close(ctx)
		return true
	}
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr)
}

func (c *Cluster) waitReady(ctx context.Context) error {
	deadline := time.Now().Add(stopWait)
	for {
		select {
		case <-c.done:
			return fmt.Errorf("postgres exited during start: %w", c.exitErr)
		default:
		}
		conn, err := pgx.Connect(ctx, c.DSN("postgres"))
		if err == nil {
			_ = conn.Close(ctx)
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("postgres not ready after %s: %w", stopWait, err)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(100 * time.Millisecond):
		}
	}
}

func (c *Cluster) ensureDatabase(ctx context.Context) error {
	conn, err := pgx.Connect(ctx, c.DSN("postgres"))
	if err != nil {
		return fmt.Errorf("connect to postgres: %w", err)
	}
	defer conn.Close(ctx)
	var exists bool
	if err := conn.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)", Database).Scan(&exists); err != nil {
		return fmt.Errorf("look up database: %w", err)
	}
	if exists {
		return nil
	}
	if _, err := conn.Exec(ctx, "CREATE DATABASE "+Database); err != nil {
		return fmt.Errorf("create database: %w", err)
	}
	return nil
}

// Stop ends an owned server with a fast shutdown and releases the lock; an attached cluster only
// forgets its socket.
func (c *Cluster) Stop() error {
	defer func() {
		if c.lock != nil {
			_ = c.lock.Close()
		}
	}()
	return c.stopChild()
}

func (c *Cluster) stopChild() error {
	if c.cmd == nil {
		return nil
	}
	select {
	case <-c.done:
		return nil
	default:
	}
	defer c.proc.close()
	if err := c.proc.stop(c, false); err != nil {
		return err
	}
	select {
	case <-c.done:
		return nil
	case <-time.After(stopWait):
		// Immediate shutdown; the next start runs crash recovery.
		_ = c.proc.stop(c, true)
		<-c.done
		return fmt.Errorf("postgres did not stop within %s; sent immediate shutdown", stopWait)
	}
}
