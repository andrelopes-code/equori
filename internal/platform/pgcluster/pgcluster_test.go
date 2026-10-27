//go:build cluster

package pgcluster

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

func testBin(t *testing.T) string {
	t.Helper()
	bin := os.Getenv("EQUORI_TEST_POSTGRES_BIN")
	if bin == "" {
		t.Fatal("EQUORI_TEST_POSTGRES_BIN is not set; run make test-cluster")
	}
	return bin
}

func execSQL(t *testing.T, c *Cluster, sql string) {
	t.Helper()
	conn, err := pgx.Connect(t.Context(), c.DSN(Database))
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(t.Context())
	if _, err := conn.Exec(t.Context(), sql); err != nil {
		t.Fatal(err)
	}
}

func query(t *testing.T, c *Cluster, sql string) string {
	t.Helper()
	conn, err := pgx.Connect(t.Context(), c.DSN(Database))
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(t.Context())
	var out string
	if err := conn.QueryRow(t.Context(), sql).Scan(&out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestStartCreatesTheCluster(t *testing.T) {
	dir := t.TempDir()
	c, err := Start(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = c.Stop() }()
	for _, name := range []string{"pg/PG_VERSION", "run", "equori.lock"} {
		if _, err := os.Stat(filepath.Join(dir, name)); err != nil {
			t.Errorf("%s: %v", name, err)
		}
	}
	if got := query(t, c, "SELECT datlocprovider::text || ' ' || datlocale FROM pg_database WHERE datname = 'equori'"); got != "b C.UTF-8" {
		t.Fatalf("locale = %q, want %q", got, "b C.UTF-8")
	}
	// M4: the builtin provider orders by code point, as musl does for the compose database.
	if got := query(t, c, "SELECT string_agg(x, ',' ORDER BY x) FROM (VALUES ('banco'), ('Água'), ('Zebra'), ('Banco')) v(x)"); got != "Banco,Zebra,banco,Água" {
		t.Fatalf("order = %q", got)
	}
	if got := query(t, c, "SHOW listen_addresses"); got != "" {
		t.Fatalf("listen_addresses = %q, want empty", got)
	}
	hba, err := os.ReadFile(filepath.Join(dir, "pg", "pg_hba.conf"))
	if err != nil || string(hba) != "local all all trust\n" {
		t.Fatalf("pg_hba.conf = %q, %v", hba, err)
	}
}

func TestStartReusesTheCluster(t *testing.T) {
	dir := t.TempDir()
	c, err := Start(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatal(err)
	}
	execSQL(t, c, "CREATE TABLE kept (id int)")
	if err := c.Stop(); err != nil {
		t.Fatal(err)
	}
	c, err = Start(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = c.Stop() }()
	if got := query(t, c, "SELECT to_regclass('kept')::text"); got != "kept" {
		t.Fatalf("table after restart = %q", got)
	}
}

// M6: a server whose serve process died keeps running; the next Start stops it and starts its own.
func TestStartStopsLeftoverServer(t *testing.T) {
	dir := t.TempDir()
	c, err := Start(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatal(err)
	}
	c.lock.Close() // the lock dies with its process; the child does not
	next, err := Start(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = next.Stop() }()
	<-c.Exited()
	if got := query(t, next, "SELECT 'up'"); got != "up" {
		t.Fatal(got)
	}
}

func TestStartRefusesBusyDirectory(t *testing.T) {
	dir := t.TempDir()
	c, err := Start(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = c.Stop() }()
	if _, err := Start(t.Context(), dir, testBin(t)); !errors.Is(err, ErrBusy) {
		t.Fatalf("second Start: %v, want ErrBusy", err)
	}
}

func TestStartRefusesOtherMajor(t *testing.T) {
	dir := t.TempDir()
	c, err := Start(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatal(err)
	}
	if err := c.Stop(); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "pg", "PG_VERSION"), []byte("17\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Start(t.Context(), dir, testBin(t)); !errors.Is(err, ErrMajorMismatch) {
		t.Fatalf("Start: %v, want ErrMajorMismatch", err)
	}
}

// M7: a command beside serve uses serve's server and never stops it.
func TestAttachUsesTheRunningServer(t *testing.T) {
	dir := t.TempDir()
	c, err := Start(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = c.Stop() }()
	a, err := Attach(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatal(err)
	}
	if a.Owned() {
		t.Fatal("Attach beside Start owns a server")
	}
	if err := a.Stop(); err != nil {
		t.Fatal(err)
	}
	if got := query(t, c, "SELECT 'still up'"); got != "still up" {
		t.Fatal(got)
	}
}

func TestAttachStartsATemporaryServer(t *testing.T) {
	dir := t.TempDir()
	a, err := Attach(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatal(err)
	}
	if !a.Owned() {
		t.Fatal("Attach alone owns no server")
	}
	if err := a.Stop(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-a.Exited():
	default:
		t.Fatal("the temporary server is still running after Stop")
	}
}

// M6 after a container restart: postmaster.pid names a PID that another process now holds and no
// server answers on the socket; Start removes the stale file and starts the server.
func TestStartIgnoresAStalePidFile(t *testing.T) {
	dir := t.TempDir()
	c, err := Start(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatal(err)
	}
	if err := c.Stop(); err != nil {
		t.Fatal(err)
	}
	other := exec.CommandContext(t.Context(), os.Args[0], "-test.run=^TestHelperSleep$")
	other.Env = append(os.Environ(), "EQUORI_TEST_HELPER=sleep")
	if err := other.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = other.Process.Kill(); _ = other.Wait() }()
	pid := fmt.Sprintf("%d\n%s\n", other.Process.Pid, filepath.Join(dir, "pg"))
	if err := os.WriteFile(filepath.Join(dir, "pg", "postmaster.pid"), []byte(pid), 0o600); err != nil {
		t.Fatal(err)
	}
	next, err := Start(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatalf("Start beside a stale pid file: %v", err)
	}
	defer func() { _ = next.Stop() }()
	if got := query(t, next, "SELECT 'up'"); got != "up" {
		t.Fatal(got)
	}
	if other.ProcessState != nil {
		t.Fatal("Start signalled the process that holds the stale PID")
	}
}

// TestHelperSleep is the process that holds the stale PID of TestStartIgnoresAStalePidFile; it
// returns at once in a normal run.
func TestHelperSleep(t *testing.T) {
	if os.Getenv("EQUORI_TEST_HELPER") != "sleep" {
		return
	}
	time.Sleep(120 * time.Second)
}
