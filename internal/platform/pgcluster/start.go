package pgcluster

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/andrelopes-code/equori/internal/platform/postgres"
)

func start(ctx context.Context, dir, bin string, lock *os.File) (*Cluster, error) {
	socket, err := prepareSocket(dir)
	if err != nil {
		return nil, err
	}

	major, err := checkMajor(ctx, bin)
	if err != nil {
		return nil, err
	}

	pgdata := filepath.Join(dir, "pg")
	if err := initialize(ctx, bin, pgdata, major); err != nil {
		return nil, err
	}

	if err := stopLeftover(ctx, bin, pgdata, socket); err != nil {
		return nil, err
	}

	c, err := spawn(dir, bin, pgdata, socket, lock)
	if err != nil {
		return nil, err
	}

	if err := awaitReady(ctx, c); err != nil {
		return nil, err
	}

	return c, nil
}

func prepareSocket(dir string) (string, error) {
	socket, err := socketDir(dir)
	if err != nil {
		return "", err
	}

	if err := privateDir(socket); err != nil {
		return "", err
	}

	return socket, nil
}

func checkMajor(ctx context.Context, bin string) (int, error) {
	major, err := Major(ctx, filepath.Join(bin, "postgres"))
	if err != nil {
		return 0, err
	}

	if major < postgres.MinMajor {
		return 0, fmt.Errorf(
			"PostgreSQL %d is older than %d, the oldest the migrations run on",
			major,
			postgres.MinMajor,
		)
	}

	return major, nil
}

func spawn(dir, bin, pgdata, socket string, lock *os.File) (*Cluster, error) {
	// Not CommandContext: the server outlives the start context and stops in Stop, after HTTP.
	cmd := exec.Command(
		filepath.Join(bin, "postgres"),
		"-D",
		pgdata,
		"-k",
		socket, //nolint:gosec,noctx // G204: the programs directory is the owner's configuration.
		"-c",
		"listen_addresses=",
		"-c",
		"max_connections="+maxConnections,
	)
	cmd.Stdout, cmd.Stderr = os.Stderr, os.Stderr

	p, err := newProc(cmd)
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		p.close()
		return nil, fmt.Errorf("start postgres: %w", err)
	}

	c := &Cluster{
		dir:    dir,
		bin:    bin,
		socket: socket,
		lock:   lock,
		cmd:    cmd,
		proc:   p,
		done:   make(chan struct{}),
	}
	go func() {
		c.exitErr = cmd.Wait()
		close(c.done)
	}()

	return c, nil
}

// awaitReady stops the child when it does not become ready.
func awaitReady(ctx context.Context, c *Cluster) error {
	if err := c.proc.started(c.cmd); err != nil {
		_ = c.stopChild()
		return err
	}

	if err := c.waitReady(ctx); err != nil {
		_ = c.stopChild()
		return err
	}

	if err := c.ensureDatabase(ctx); err != nil {
		_ = c.stopChild()
		return err
	}

	return nil
}
