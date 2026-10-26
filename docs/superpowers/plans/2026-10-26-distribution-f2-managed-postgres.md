# Distribution F2: Managed PostgreSQL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Without `EQUORI_DATABASE_URL`, `equori` runs its own PostgreSQL server over a data directory, backs it up, restores it, and ships as a one-container image.

**Architecture:** A new package `internal/platform/pgcluster` starts, attaches to and stops a PostgreSQL child process over a Unix socket in the data directory. A new package `internal/platform/backup` writes and restores `pg_dump` archives. `cmd/equori` selects external or managed mode from the configuration, takes a backup before pending migrations, runs a daily backup while serving, and gains `backup`, `restore` and `secrets key`. A `standalone` Dockerfile stage derives from `postgres:18`.

**Tech Stack:** Go 1.27 (`os/exec`, `syscall.Flock`), pgx v5, PostgreSQL 18 programs (`initdb`, `postgres`, `pg_ctl`, `pg_dump`, `pg_restore`), Docker.

**Spec:** `docs/superpowers/specs/2026-10-26-distribution-design.md` (phase F2: D2, C2, C3, D4, managed part of V4, standalone image, section "Settled during planning").

**Requires:** F1 complete (`postgres.LatestVersion`, `postgres.MinMajor`, `postgres.ErrSchemaAhead`, ADR 021).

## Global Constraints

- Data directory layout (M3): `pg/` (cluster, 0700), `run/` (socket directory, 0700), `backups/`, `secret.key` (0600), `equori.env`, `equori.lock`.
- Cluster creation (M4): `initdb -D <dir>/pg -U equori --encoding=UTF8 --locale=C --locale-provider=builtin --builtin-locale=C.UTF-8 --auth=trust`, then `pg_hba.conf` is exactly `local all all trust\n`.
- Server flags on every start: `-D <dir>/pg -k <socket dir> -c listen_addresses= -c max_connections=50`.
- Role and database name: `equori`.
- Socket path limit: `len(<socket dir>) + len("/.s.PGSQL.5432") <= 103`; otherwise `<os.TempDir()>/equori-<first 12 hex digits of SHA-256 of the absolute data directory>`.
- Stop: SIGINT (fast shutdown), wait 60 s, then SIGQUIT.
- Backups: file names `<prefix>-<YYYY-MM-DD>-s<schema>.dump`; prefixes `equori` (manual), `periodic`, `pre-migration`; retention 7 periodic, 3 pre-migration; mode 0600.
- Restore creates the database with `TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER builtin BUILTIN_LOCALE 'C.UTF-8'`.
- Managed mode runs on `unix` build targets only; on other targets the package returns `pgcluster.ErrUnsupported`.
- Tests that need PostgreSQL programs carry `//go:build cluster` and run only through `make test-cluster`. They call `t.Fatal`, never `t.Skip`, when `EQUORI_TEST_POSTGRES_BIN` is unset.
- No new Go module dependency.
- Every rule of `CLAUDE.md` applies (comments, errors, naming, commits).

## Review Focus

1. A server left running by a killed `serve` (SIGKILL, power loss): the next `serve` must stop it and start its own. Test `TestStartStopsLeftoverServer` (Task 2) and smoke step 8 (Task 9).
2. A data directory under a long path, such as `~/Library/Application Support/equori` for a long user name: the socket must move to the temporary directory. Test `TestSocketDir` (Task 1).
3. Another user who pre-created the fallback socket directory in a shared `/tmp`: start must refuse it. Test `TestEnsurePrivateDirRefusesForeignMode` (Task 1).
4. `equori restore` while `serve` runs: refused, nothing dropped. Smoke step 10 (Task 9).
5. A dump taken by a newer binary: restore refuses before dropping anything. Test `TestRestoreRefusesNewerDump` (Task 3).

---

### Task 1: PostgreSQL programs, socket directory and root check

**Files:**
- Create: `internal/platform/pgcluster/program.go`
- Create: `internal/platform/pgcluster/socket.go`
- Test: `internal/platform/pgcluster/program_test.go`, `internal/platform/pgcluster/socket_test.go`

**Interfaces:**
- Produces (package `pgcluster`, files without build tags):
  - `func Bin(explicit string) (string, error)`: `explicit` when it holds a `postgres` file, else the directory of `postgres` found on `PATH`.
  - `func Major(ctx context.Context, program string) (int, error)`: runs `<program> --version` and returns the major.
  - `func parseMajor(out string) (int, error)`: `"postgres (PostgreSQL) 18.6"` → 18; `"pg_dump (PostgreSQL) 18.6 (Debian 18.6-1.pgdg13+1)"` → 18.
  - `func socketDir(dataDir string) (string, error)` and `func ensurePrivateDir(path string) error`.
  - `func refuseRoot(euid int) error` and `var ErrRoot = errors.New("managed mode does not run as root: PostgreSQL refuses it")`.

- [ ] **Step 1: Write the failing tests**

`program_test.go`:

```go
package pgcluster

func TestParseMajor(t *testing.T) {
	t.Parallel()
	tests := []struct {
		out  string
		want int
		err  bool
	}{
		{out: "postgres (PostgreSQL) 18.6\n", want: 18},
		{out: "pg_dump (PostgreSQL) 18.6 (Debian 18.6-1.pgdg13+1)\n", want: 18},
		{out: "postgres (PostgreSQL) 19beta3\n", want: 19},
		{out: "something else\n", err: true},
	}
	for _, tt := range tests {
		got, err := parseMajor(tt.out)
		if (err != nil) != tt.err || got != tt.want {
			t.Errorf("parseMajor(%q) = %d, %v; want %d, error %v", tt.out, got, err, tt.want, tt.err)
		}
	}
}

func TestBinExplicit(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "postgres"), []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	if got, err := Bin(dir); err != nil || got != dir {
		t.Fatalf("Bin(%q) = %q, %v", dir, got, err)
	}
	if _, err := Bin(t.TempDir()); err == nil {
		t.Fatal("Bin of a directory without postgres: want an error")
	}
}

func TestBinFromPath(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "postgres"), []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir)
	if got, err := Bin(""); err != nil || got != dir {
		t.Fatalf(`Bin("") = %q, %v; want %q`, got, err, dir)
	}
}

func TestRefuseRoot(t *testing.T) {
	t.Parallel()
	if !errors.Is(refuseRoot(0), ErrRoot) || refuseRoot(1000) != nil {
		t.Fatal("refuseRoot: want ErrRoot for 0 and nil for 1000")
	}
}
```

`socket_test.go`:

```go
package pgcluster

func TestSocketDir(t *testing.T) {
	t.Parallel()
	short := t.TempDir()
	if got, err := socketDir(short); err != nil || got != filepath.Join(short, "run") {
		t.Fatalf("socketDir(%q) = %q, %v", short, got, err)
	}
	long := filepath.Join(short, strings.Repeat("a", 100))
	got, err := socketDir(long)
	if err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256([]byte(long))
	want := filepath.Join(os.TempDir(), "equori-"+hex.EncodeToString(sum[:])[:12])
	if got != want {
		t.Fatalf("socketDir(long) = %q, want %q", got, want)
	}
}

func TestEnsurePrivateDirCreates(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "run")
	if err := ensurePrivateDir(path); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o700 {
		t.Fatalf("mode = %v, %v; want 0700", info.Mode().Perm(), err)
	}
}

func TestEnsurePrivateDirRefusesForeignMode(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "run")
	if err := os.Mkdir(path, 0o777); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(path, 0o777); err != nil {
		t.Fatal(err)
	}
	if err := ensurePrivateDir(path); err == nil {
		t.Fatal("a directory with mode 0777: want an error")
	}
}
```

Add the imports each file needs (`crypto/sha256`, `encoding/hex`, `errors`, `os`, `path/filepath`, `strings`, `testing`).

- [ ] **Step 2: Run** `go test ./internal/platform/pgcluster/`
Expected: build failure, undefined `parseMajor`, `Bin`, `refuseRoot`, `socketDir`, `ensurePrivateDir`.

- [ ] **Step 3: Implement.** `program.go` starts with the package comment `// Package pgcluster runs a private PostgreSQL server over a data directory (ADR 021, managed mode).`

```go
var versionLine = regexp.MustCompile(`\(PostgreSQL\) (\d+)`)

func parseMajor(out string) (int, error) {
	m := versionLine.FindStringSubmatch(out)
	if m == nil {
		return 0, fmt.Errorf("parse version %q: no PostgreSQL major", strings.TrimSpace(out))
	}
	return strconv.Atoi(m[1])
}
```

- `Major`: `exec.CommandContext(ctx, program, "--version").Output()`, error `fmt.Errorf("run %s --version: %w", program, err)`, then `parseMajor`.
- `Bin`: explicit non-empty → `os.Stat(filepath.Join(explicit, "postgres"))`; error `fmt.Errorf("EQUORI_POSTGRES_BIN %s: %w", explicit, err)`. Empty → `exec.LookPath("postgres")`; error `fmt.Errorf("find postgres on PATH; set EQUORI_POSTGRES_BIN to the directory of the PostgreSQL programs: %w", err)`; return `filepath.Dir`.
- `refuseRoot(euid int) error`: `ErrRoot` when `euid == 0`.

`socket.go`:

```go
// sun_path holds 104 bytes on macOS and 108 on Linux, the terminating NUL included.
const socketLimit = 103

func socketDir(dataDir string) (string, error) {
	abs, err := filepath.Abs(dataDir)
	if err != nil {
		return "", fmt.Errorf("resolve data directory: %w", err)
	}
	run := filepath.Join(abs, "run")
	if len(run)+len("/.s.PGSQL.5432") <= socketLimit {
		return run, nil
	}
	sum := sha256.Sum256([]byte(abs))
	return filepath.Join(os.TempDir(), "equori-"+hex.EncodeToString(sum[:])[:12]), nil
}

// ensurePrivateDir creates path with mode 0700 and refuses one that another user could enter:
// the fallback of socketDir lives in a shared temporary directory.
func ensurePrivateDir(path string) error {
	if err := os.MkdirAll(path, 0o700); err != nil {
		return fmt.Errorf("create %s: %w", path, err)
	}
	info, err := os.Lstat(path)
	if err != nil {
		return fmt.Errorf("inspect %s: %w", path, err)
	}
	if !info.IsDir() || info.Mode().Perm() != 0o700 {
		return fmt.Errorf("%s must be a directory with mode 0700, found %v", path, info.Mode())
	}
	return nil
}
```

Ownership is checked in Task 2 (`owner_unix.go`), because `syscall.Stat_t` exists only on unix.

- [ ] **Step 4: Run** `go test ./internal/platform/pgcluster/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/platform/pgcluster
git commit -m "feat(platform): locate postgres programs and a private socket directory" -m "First part of managed mode (ADR 021, M2 and M5): the programs come from
EQUORI_POSTGRES_BIN or PATH, the socket directory moves to the
temporary directory when its path exceeds the Unix socket limit, and a
socket directory another user can enter is refused."
```

---

### Task 2: Cluster lifecycle and the `cluster` test target

**Files:**
- Create: `internal/platform/pgcluster/pgcluster.go` (`//go:build unix`)
- Create: `internal/platform/pgcluster/pgcluster_other.go` (`//go:build !unix`)
- Create: `internal/platform/pgcluster/owner_unix.go` (`//go:build unix`)
- Test: `internal/platform/pgcluster/pgcluster_test.go` (`//go:build cluster`)
- Modify: `Makefile` (target `test-cluster`; `check` runs it)
- Modify: `.golangci.yml` (`run.build-tags`)

**Interfaces:**
- Consumes: Task 1; `postgres.MinMajor` (F1).
- Produces (package `pgcluster`):
  - `type Cluster struct` with methods `Bin() string`, `Owned() bool`, `DSN(database string) string`, `Exited() <-chan struct{}`, `ExitErr() error`, `Stop() error`.
  - `func Start(ctx context.Context, dir, bin string) (*Cluster, error)` (M6: `serve`).
  - `func Attach(ctx context.Context, dir, bin string) (*Cluster, error)` (M7: every other command).
  - `var ErrBusy = errors.New("another equori process manages this data directory")`, `var ErrMajorMismatch = errors.New("the PostgreSQL major differs from the data directory's")`, `var ErrUnsupported = errors.New("managed mode runs on Linux and macOS; set EQUORI_DATABASE_URL")`.
  - `const Database = "equori"`.

- [ ] **Step 1: Add the test infrastructure**

`Makefile`, after `test-race`:

```make
# Managed mode needs the PostgreSQL programs; the postgres:18 image holds them, so the compiled
# cluster tests run there, on the host network to reach db-test (ADR 021). Each entry is
# <package directory>:<-test.run pattern>.
CLUSTER_TESTS := internal/platform/pgcluster:.
test-cluster: db-test-up
	rm -rf $(BIN)/cluster-tests && mkdir -p $(BIN)/cluster-tests
	for entry in $(CLUSTER_TESTS); do \
		pkg=$${entry%%:*} && pattern=$${entry#*:} && test=$(BIN)/cluster-tests/$$(basename $$pkg).test && \
		CGO_ENABLED=0 go test -c -tags cluster -o $$test ./$$pkg && \
		docker run --rm --network host -u postgres -v $$test:/cluster.test:ro \
			-e EQUORI_TEST_POSTGRES_BIN=/usr/lib/postgresql/18/bin \
			-e EQUORI_TEST_DATABASE_URL=$(EQUORI_TEST_DATABASE_URL) \
			postgres:18 /cluster.test -test.count=1 -test.v -test.run "$$pattern" || exit 1; \
	done
```

Change `check:` so its second line reads `$(MAKE) --no-print-directory -j2 test-race web-static` followed by a new line `$(MAKE) --no-print-directory test-cluster`. Add `test-cluster` to `.PHONY`. Task 3 appends `internal/platform/backup:.` and Task 8 appends `internal/server:^TestCluster` to `CLUSTER_TESTS`.

`.golangci.yml`, at top level after `version: "2"`:

```yaml
run:
  build-tags:
    - cluster
```

- [ ] **Step 2: Write the failing tests** in `pgcluster_test.go`:

```go
//go:build cluster

package pgcluster

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
	defer c.Stop()
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
	defer c.Stop()
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
	defer next.Stop()
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
	defer c.Stop()
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
	defer c.Stop()
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
```

Add the imports `errors`, `os`, `path/filepath`, `testing`, `github.com/jackc/pgx/v5`.

- [ ] **Step 3: Run** `make test-cluster`
Expected: build failure, undefined `Start`, `Attach`, `Database`, `ErrBusy`, `ErrMajorMismatch`.

- [ ] **Step 4: Implement `owner_unix.go`**

```go
//go:build unix

package pgcluster

// ownedByMe reports whether the current user owns path; the fallback socket directory sits in a
// shared temporary directory where another user could have created it first.
func ownedByMe(info os.FileInfo) bool {
	st, ok := info.Sys().(*syscall.Stat_t)
	return ok && int(st.Uid) == os.Getuid()
}
```

In `ensurePrivateDir` (Task 1), the condition becomes `!info.IsDir() || info.Mode().Perm() != 0o700 || !ownedByMe(info)`. Because `socket.go` has no build tag, add `pgcluster_other.go` (`//go:build !unix`) with `func ownedByMe(os.FileInfo) bool { return true }` and the `!unix` versions of `Start` and `Attach` that return `nil, ErrUnsupported`. Declare `ErrUnsupported` in `program.go`, so both build variants see it.

- [ ] **Step 5: Implement `pgcluster.go`**

```go
//go:build unix

package pgcluster

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
	done             chan struct{} // closed when the child exits; nil when attached
	exitErr          error
}

func (c *Cluster) Bin() string               { return c.bin }
func (c *Cluster) Owned() bool               { return c.cmd != nil }
func (c *Cluster) Exited() <-chan struct{}   { return c.done }
func (c *Cluster) ExitErr() error            { return c.exitErr }

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
	if err := refuseRoot(os.Geteuid()); err != nil {
		return nil, err
	}
	lock, err := lockDir(dir)
	if err != nil {
		return nil, err
	}
	c, err := start(ctx, dir, bin, lock)
	if err != nil {
		lock.Close()
		return nil, err
	}
	return c, nil
}

// Attach serves a command other than serve (M7): it connects to serve's server when serve holds
// the lock, and otherwise starts a temporary server that Stop ends.
func Attach(ctx context.Context, dir, bin string) (*Cluster, error) {
	if err := refuseRoot(os.Geteuid()); err != nil {
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
		conn.Close(ctx)
		return c, nil
	}
	if err != nil {
		return nil, err
	}
	c, err := start(ctx, dir, bin, lock)
	if err != nil {
		lock.Close()
		return nil, err
	}
	return c, nil
}

func lockDir(dir string) (*os.File, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("create data directory: %w", err)
	}
	f, err := os.OpenFile(filepath.Join(dir, "equori.lock"), os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, fmt.Errorf("open lock: %w", err)
	}
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		f.Close()
		if errors.Is(err, syscall.EWOULDBLOCK) {
			return nil, ErrBusy
		}
		return nil, fmt.Errorf("lock data directory: %w", err)
	}
	return f, nil
}

func start(ctx context.Context, dir, bin string, lock *os.File) (*Cluster, error) {
	socket, err := socketDir(dir)
	if err != nil {
		return nil, err
	}
	if err := ensurePrivateDir(socket); err != nil {
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
	if err := stopLeftover(ctx, bin, pgdata); err != nil {
		return nil, err
	}
	// Not CommandContext: the server outlives the start context and stops in Stop, after HTTP.
	cmd := exec.Command(filepath.Join(bin, "postgres"), "-D", pgdata, "-k", socket, //nolint:gosec,noctx // G204: the programs directory is the owner's configuration.
		"-c", "listen_addresses=", "-c", "max_connections="+maxConnections)
	cmd.Stdout, cmd.Stderr = os.Stderr, os.Stderr
	// Its own process group: a terminal's Ctrl-C reaches serve only, which stops the server last.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start postgres: %w", err)
	}
	c := &Cluster{dir: dir, bin: bin, socket: socket, lock: lock, cmd: cmd, done: make(chan struct{})}
	go func() {
		c.exitErr = cmd.Wait()
		close(c.done)
	}()
	if err := c.waitReady(ctx); err != nil {
		c.stopChild()
		return nil, err
	}
	if err := c.ensureDatabase(ctx); err != nil {
		c.stopChild()
		return nil, err
	}
	return c, nil
}

func initialize(ctx context.Context, bin, pgdata string, major int) error {
	b, err := os.ReadFile(filepath.Join(pgdata, "PG_VERSION"))
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

func stopLeftover(ctx context.Context, bin, pgdata string) error {
	if _, err := os.Stat(filepath.Join(pgdata, "postmaster.pid")); errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	pgctl := filepath.Join(bin, "pg_ctl")
	// Exit status 3: no server runs; postgres removes a stale pid file by itself.
	if exec.CommandContext(ctx, pgctl, "status", "-D", pgdata).Run() != nil { //nolint:gosec // G204: as above.
		return nil
	}
	out, err := exec.CommandContext(ctx, pgctl, "stop", "-D", pgdata, "-m", "fast", "-w", "-t", "60").CombinedOutput() //nolint:gosec // G204: as above.
	if err != nil {
		return fmt.Errorf("stop the server left running: %w: %s", err, out)
	}
	return nil
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
			conn.Close(ctx)
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
			c.lock.Close()
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
	if err := c.cmd.Process.Signal(syscall.SIGINT); err != nil && !errors.Is(err, os.ErrProcessDone) {
		return fmt.Errorf("signal postgres: %w", err)
	}
	select {
	case <-c.done:
		return nil
	case <-time.After(stopWait):
		// Immediate shutdown; the next start runs crash recovery.
		_ = c.cmd.Process.Signal(syscall.SIGQUIT)
		<-c.done
		return fmt.Errorf("postgres did not stop within %s; sent immediate shutdown", stopWait)
	}
}
```

Imports: `context`, `errors`, `fmt`, `io/fs`, `os`, `os/exec`, `path/filepath`, `strconv`, `strings`, `syscall`, `time`, `github.com/jackc/pgx/v5`, `github.com/andrelopes-code/equori/internal/platform/postgres`. If golangci-lint flags a `nolint` directive as unused, remove that linter name from it.

- [ ] **Step 6: Run** `make test-cluster` and `go build ./... && GOOS=windows go build ./internal/platform/pgcluster/`
Expected: every test of `pgcluster_test.go` passes; both builds succeed.

- [ ] **Step 7: Run** `make lint`
Expected: no finding.

- [ ] **Step 8: Commit**

```bash
git add internal/platform/pgcluster Makefile .golangci.yml
git commit -m "feat(platform): run a private postgres server over a data directory" -m "Start (serve) and Attach (every other command) share one lock per data
directory. The cluster is created with the builtin C.UTF-8 provider, so
an operating system upgrade never changes the order of an index, and
listens on a Unix socket only. A server left by a dead process is
stopped before a new one starts (ADR 021, M3 to M9). The tests need
the PostgreSQL programs and run inside postgres:18 (make test-cluster)."
```

---

### Task 3: Backup archives

**Files:**
- Create: `internal/platform/backup/backup.go`
- Create: `internal/platform/backup/files.go`
- Test: `internal/platform/backup/files_test.go` (no tag), `internal/platform/backup/backup_test.go` (`//go:build cluster`)
- Modify: `Makefile` (`CLUSTER_TESTS` gains `internal/platform/backup:.`)

**Interfaces:**
- Consumes: `pgcluster.Major`, `pgcluster.Start`, `Cluster.DSN`, `Cluster.Bin` (Tasks 1, 2).
- Produces (package `backup`, comment `// Package backup writes and restores pg_dump archives of the database (ADR 021, D4).`):
  - `func Name(prefix string, day time.Time, schema int64) string` → `fmt.Sprintf("%s-%s-s%d.dump", prefix, day.Format(time.DateOnly), schema)`.
  - `const Manual, Periodic, PreMigration = "equori", "periodic", "pre-migration"` (one `const` block).
  - `func Dump(ctx context.Context, bin, dsn, path string) error`.
  - `func DumpVersion(ctx context.Context, bin, path string) (int64, error)`.
  - `func Restore(ctx context.Context, bin, dsn, path string, latest int64) error`.
  - `func Prune(dir, prefix string, keep int) error`: deletes all but the `keep` newest files named `<prefix>-*.dump`, by name order (the date sorts lexically).
  - `func Newest(dir, prefix string) (string, error)`: full path of the newest `<prefix>-*.dump`, `""` when none.
  - `func Due(dir string, now time.Time, every time.Duration) (bool, error)`: true when no `periodic-*.dump` exists or the newest one's modification time is at least `every` before `now`.
  - `var ErrDumpAhead`, `var ErrOldProgram` (texts below).

- [ ] **Step 1: Write the failing unit tests** in `files_test.go`:

```go
func TestName(t *testing.T) {
	t.Parallel()
	got := Name(Periodic, time.Date(2026, 10, 26, 23, 0, 0, 0, time.UTC), 60)
	if got != "periodic-2026-10-26-s60.dump" {
		t.Fatal(got)
	}
}

func touch(t *testing.T, dir, name string, mod time.Time) {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(path, mod, mod); err != nil {
		t.Fatal(err)
	}
}

func TestPruneKeepsTheNewest(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	for day := 1; day <= 9; day++ {
		touch(t, dir, fmt.Sprintf("periodic-2026-10-%02d-s60.dump", day), time.Now())
	}
	touch(t, dir, "pre-migration-2026-10-01-s59.dump", time.Now())
	if err := Prune(dir, Periodic, 7); err != nil {
		t.Fatal(err)
	}
	names, _ := filepath.Glob(filepath.Join(dir, "*.dump"))
	if len(names) != 8 || filepath.Base(names[1]) != "periodic-2026-10-03-s60.dump" {
		t.Fatalf("after Prune: %v", names)
	}
}

func TestDue(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC)
	dir := t.TempDir()
	if due, err := Due(dir, now, 24*time.Hour); err != nil || !due {
		t.Fatalf("empty directory: %v, %v; want due", due, err)
	}
	touch(t, dir, "periodic-2026-10-26-s60.dump", now.Add(-23*time.Hour))
	if due, _ := Due(dir, now, 24*time.Hour); due {
		t.Fatal("23 hours old: want not due")
	}
	touch(t, dir, "periodic-2026-10-26-s60.dump", now.Add(-24*time.Hour))
	if due, _ := Due(dir, now, 24*time.Hour); !due {
		t.Fatal("24 hours old: want due")
	}
}

func TestNewest(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	if got, err := Newest(dir, PreMigration); err != nil || got != "" {
		t.Fatalf("empty: %q, %v", got, err)
	}
	touch(t, dir, "pre-migration-2026-10-01-s59.dump", time.Now())
	touch(t, dir, "pre-migration-2026-10-20-s60.dump", time.Now())
	if got, _ := Newest(dir, PreMigration); got != filepath.Join(dir, "pre-migration-2026-10-20-s60.dump") {
		t.Fatal(got)
	}
}

func TestParseDumpVersion(t *testing.T) {
	t.Parallel()
	script := "SET x;\nCOPY public.goose_db_version (id, version_id, is_applied, tstamp) FROM stdin;\n1\t0\tt\t2026-10-01 00:00:00\n2\t1\tt\t2026-10-01 00:00:00\n61\t60\tt\t2026-10-26 00:00:00\n\\.\n"
	if got, err := parseDumpVersion(script); err != nil || got != 60 {
		t.Fatalf("parseDumpVersion = %d, %v; want 60", got, err)
	}
	if _, err := parseDumpVersion("SET x;\n"); err == nil {
		t.Fatal("no COPY block: want an error")
	}
}
```

- [ ] **Step 2: Write the failing cluster tests** in `backup_test.go`:

```go
//go:build cluster

package backup

func testCluster(t *testing.T) *pgcluster.Cluster {
	t.Helper()
	bin := os.Getenv("EQUORI_TEST_POSTGRES_BIN")
	if bin == "" {
		t.Fatal("EQUORI_TEST_POSTGRES_BIN is not set; run make test-cluster")
	}
	c, err := pgcluster.Start(t.Context(), t.TempDir(), bin)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { c.Stop() })
	return c
}

func execSQL(t *testing.T, dsn, sql string) {
	t.Helper()
	conn, err := pgx.Connect(t.Context(), dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(t.Context())
	if _, err := conn.Exec(t.Context(), sql); err != nil {
		t.Fatal(err)
	}
}

func TestDumpAndRestore(t *testing.T) {
	c := testCluster(t)
	dsn := c.DSN(pgcluster.Database)
	execSQL(t, dsn, "CREATE TABLE goose_db_version (id serial, version_id bigint, is_applied boolean, tstamp timestamp DEFAULT now()); INSERT INTO goose_db_version (version_id, is_applied) VALUES (0, true), (60, true); CREATE TABLE fact (v text); INSERT INTO fact VALUES ('kept')")
	path := filepath.Join(t.TempDir(), "x.dump")
	if err := Dump(t.Context(), c.Bin(), dsn, path); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("dump mode = %v, %v; want 0600", info.Mode().Perm(), err)
	}
	if v, err := DumpVersion(t.Context(), c.Bin(), path); err != nil || v != 60 {
		t.Fatalf("DumpVersion = %d, %v", v, err)
	}
	execSQL(t, dsn, "INSERT INTO fact VALUES ('after the dump')")
	if err := Restore(t.Context(), c.Bin(), dsn, path, 60); err != nil {
		t.Fatal(err)
	}
	conn, err := pgx.Connect(t.Context(), dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(t.Context())
	var facts, provider string
	if err := conn.QueryRow(t.Context(), "SELECT string_agg(v, ',') FROM fact").Scan(&facts); err != nil || facts != "kept" {
		t.Fatalf("facts = %q, %v", facts, err)
	}
	if err := conn.QueryRow(t.Context(), "SELECT datlocprovider::text || ' ' || datlocale FROM pg_database WHERE datname = current_database()").Scan(&provider); err != nil || provider != "b C.UTF-8" {
		t.Fatalf("restored locale = %q, %v", provider, err)
	}
}

func TestRestoreRefusesNewerDump(t *testing.T) {
	c := testCluster(t)
	dsn := c.DSN(pgcluster.Database)
	execSQL(t, dsn, "CREATE TABLE goose_db_version (id serial, version_id bigint, is_applied boolean, tstamp timestamp DEFAULT now()); INSERT INTO goose_db_version (version_id, is_applied) VALUES (61, true); CREATE TABLE fact (v text)")
	path := filepath.Join(t.TempDir(), "x.dump")
	if err := Dump(t.Context(), c.Bin(), dsn, path); err != nil {
		t.Fatal(err)
	}
	execSQL(t, dsn, "INSERT INTO fact VALUES ('untouched')")
	if err := Restore(t.Context(), c.Bin(), dsn, path, 60); !errors.Is(err, ErrDumpAhead) {
		t.Fatalf("Restore: %v, want ErrDumpAhead", err)
	}
	execSQL(t, dsn, "SELECT 1 FROM fact WHERE v = 'untouched'")
}
```

The second test's last line proves the database was not dropped: the table still exists. Append `internal/platform/backup:.` to `CLUSTER_TESTS` in the Makefile.

- [ ] **Step 3: Run** `go test ./internal/platform/backup/` and `make test-cluster`
Expected: build failures for every undefined name.

- [ ] **Step 4: Implement `files.go`** (`Name`, the constants, `Prune`, `Newest`, `Due`) with `filepath.Glob(filepath.Join(dir, prefix+"-*.dump"))`, `slices.Sort` and `os.Stat(...).ModTime()`. A missing directory yields no files, not an error (`Glob` returns nil).

- [ ] **Step 5: Implement `backup.go`**

```go
var (
	ErrDumpAhead  = errors.New("the dump holds a migration this binary does not know")
	ErrOldProgram = errors.New("pg_dump is older than the server")
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
	f, err := os.OpenFile(partial, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
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
		os.Remove(partial)
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
	defer conn.Close(ctx)
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
		return 0, fmt.Errorf("pg_restore --list of %s: %w", path, err)
	}
	return parseDumpVersion(string(out))
}

func parseDumpVersion(script string) (int64, error) {
	var latest int64
	in := false
	found := false
	for line := range strings.Lines(script) {
		line = strings.TrimSuffix(line, "\n")
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
	defer conn.Close(ctx)
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
```

`strings.Lines` exists since Go 1.24. Fix the error text of `DumpVersion` to `"read goose_db_version of %s: %w"`.

- [ ] **Step 6: Run** `go test ./internal/platform/backup/ && make test-cluster && make lint`
Expected: PASS, no lint finding.

- [ ] **Step 7: Commit**

```bash
git add internal/platform/backup Makefile
git commit -m "feat(platform): write and restore database backups" -m "Dump writes pg_dump's custom format with mode 0600 and refuses a
pg_dump older than the server. Restore refuses a dump of a newer
schema before dropping anything and recreates the database with the
builtin C.UTF-8 provider (ADR 021, B1 and B2)."
```

---

### Task 4: Pending migrations and the database locale

**Files:**
- Modify: `internal/platform/postgres/postgres.go`
- Test: `internal/platform/postgres/postgres_test.go`

**Interfaces:**
- Produces:
  - `func Pending(ctx context.Context, pool *pgxpool.Pool) (current int64, pending bool, err error)`: `current` from goose `GetDBVersion`; `pending` is `current > 0 && current < LatestVersion()`. A fresh database (version 0) has nothing to back up.
  - `func Locale(ctx context.Context, pool *pgxpool.Pool) (provider, locale string, err error)`: `SELECT datlocprovider::text, coalesce(datlocale, '') FROM pg_database WHERE datname = current_database()`.

- [ ] **Step 1: Write the failing tests**

```go
func TestPending(t *testing.T) {
	t.Parallel()
	ctx := t.Context()
	discard := slog.New(slog.NewTextHandler(io.Discard, nil))
	empty := pgtest.Empty(t)
	if _, pending, err := postgres.Pending(ctx, empty); err != nil || pending {
		t.Fatalf("empty database: pending %v, %v; want false", pending, err)
	}
	if err := postgres.MigrateTo(ctx, empty, 5, discard); err != nil {
		t.Fatal(err)
	}
	if current, pending, err := postgres.Pending(ctx, empty); err != nil || !pending || current != 5 {
		t.Fatalf("at version 5: %d, %v, %v; want 5, true", current, pending, err)
	}
	if _, pending, err := postgres.Pending(ctx, pgtest.New(t)); err != nil || pending {
		t.Fatalf("migrated: pending %v, %v; want false", pending, err)
	}
}

// The compose and test servers run postgres:18-alpine; musl orders by code point, as the builtin
// provider of managed mode does (ADR 021, M4). A failure here disproves that premise: stop and report.
func TestTestServerOrdersByCodePoint(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	var got string
	if err := pool.QueryRow(t.Context(), "SELECT string_agg(x, ',' ORDER BY x) FROM (VALUES ('banco'), ('Água'), ('Zebra'), ('Banco')) v(x)").Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != "Banco,Zebra,banco,Água" {
		t.Fatalf("order = %q", got)
	}
}

func TestLocale(t *testing.T) {
	t.Parallel()
	provider, _, err := postgres.Locale(t.Context(), pgtest.New(t))
	if err != nil || provider != "c" {
		t.Fatalf("Locale() provider = %q, %v; want %q (libc)", provider, err, "c")
	}
}
```

- [ ] **Step 2: Run** `go test -run 'TestPending|TestTestServerOrdersByCodePoint|TestLocale' ./internal/platform/postgres/`
Expected: build failure, undefined `Pending` and `Locale`. If, after Step 3, `TestTestServerOrdersByCodePoint` fails, do not change its expectation: record the actual order in `.claude/progress/current.md` under known problems and stop the slice.

- [ ] **Step 3: Implement** both functions. `Pending` builds a goose provider the same way `MigrateTo` does; extract the provider construction into `func newProvider(pool *pgxpool.Pool) (*goose.Provider, *sql.DB, error)` used by both, and close the `*sql.DB` in the callers.

- [ ] **Step 4: Run** `go test ./internal/platform/postgres/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/platform/postgres
git commit -m "feat(platform): report pending migrations and the database locale" -m "Managed mode backs up before pending migrations (B3) and serve warns
when the database orders text by the host's locale (B7)."
```

---

### Task 5: Configuration of managed mode (M1, C2)

**Files:**
- Create: `internal/platform/config/env_file.go`
- Create: `internal/platform/config/data_dir.go`
- Modify: `internal/platform/config/config.go`
- Test: `internal/platform/config/env_file_test.go`, `internal/platform/config/data_dir_test.go`, `internal/platform/config/config_test.go`

**Interfaces:**
- Produces:
  - `Config` gains `DataDir, PostgresBin, BackupDir string` and `func (c Config) Managed() bool { return c.DatabaseURL == "" }`.
  - `func DefaultDataDir(goos string, getenv func(string) string) string`: linux → `$XDG_DATA_HOME/equori`, or `$HOME/.local/share/equori` when `XDG_DATA_HOME` is empty; darwin → `$HOME/Library/Application Support/equori`; `""` when `HOME` is empty or `goos` is another system.
  - `func ReadEnvFile(path string) (map[string]string, error)`: a missing file yields an empty map.
  - `func WithFile(getenv func(string) string, file map[string]string) func(string) string`: the process value when non-empty, otherwise the file value.
  - In `Load`: without `EQUORI_DATABASE_URL`, `DataDir` is `EQUORI_DATA_DIR`, else `DefaultDataDir(runtime.GOOS, getenv)`. An empty result returns `errors.New("EQUORI_DATABASE_URL is not set and this system has no default data directory; set EQUORI_DATABASE_URL or EQUORI_DATA_DIR")`. `BackupDir` is `EQUORI_BACKUP_DIR`, else `<DataDir>/backups`. `PostgresBin` is `EQUORI_POSTGRES_BIN`. With `EQUORI_DATABASE_URL` set, `DataDir` stays empty and `BackupDir` is `EQUORI_BACKUP_DIR` or empty.

- [ ] **Step 1: Write the failing tests**

`env_file_test.go`:

```go
func TestReadEnvFile(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "equori.env")
	content := "# settings\n\nEQUORI_HTTP_ADDR=127.0.0.1:9000\n  EQUORI_PRICE_FEEDS = bcb_ptax,ecb  \nEQUORI_EMPTY=\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := ReadEnvFile(path)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{"EQUORI_HTTP_ADDR": "127.0.0.1:9000", "EQUORI_PRICE_FEEDS": "bcb_ptax,ecb", "EQUORI_EMPTY": ""}
	if !maps.Equal(got, want) {
		t.Fatalf("ReadEnvFile = %v, want %v", got, want)
	}
}

func TestReadEnvFileErrors(t *testing.T) {
	t.Parallel()
	for _, content := range []string{"NO_EQUALS_SIGN\n", "lower=case\n", "1START=x\n"} {
		path := filepath.Join(t.TempDir(), "equori.env")
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
		if _, err := ReadEnvFile(path); err == nil || !strings.Contains(err.Error(), "line 1") {
			t.Errorf("ReadEnvFile(%q) error = %v, want one naming line 1", content, err)
		}
	}
}

func TestReadEnvFileMissing(t *testing.T) {
	t.Parallel()
	got, err := ReadEnvFile(filepath.Join(t.TempDir(), "absent.env"))
	if err != nil || len(got) != 0 {
		t.Fatalf("missing file: %v, %v", got, err)
	}
}

func TestWithFile(t *testing.T) {
	t.Parallel()
	process := map[string]string{"A": "process", "B": ""}
	getenv := WithFile(func(k string) string { return process[k] }, map[string]string{"A": "file", "B": "file", "C": "file"})
	for key, want := range map[string]string{"A": "process", "B": "file", "C": "file", "D": ""} {
		if got := getenv(key); got != want {
			t.Errorf("getenv(%q) = %q, want %q", key, got, want)
		}
	}
}
```

`data_dir_test.go`:

```go
func TestDefaultDataDir(t *testing.T) {
	t.Parallel()
	env := func(m map[string]string) func(string) string { return func(k string) string { return m[k] } }
	tests := []struct {
		goos string
		env  map[string]string
		want string
	}{
		{"linux", map[string]string{"HOME": "/home/a"}, "/home/a/.local/share/equori"},
		{"linux", map[string]string{"HOME": "/home/a", "XDG_DATA_HOME": "/data"}, "/data/equori"},
		{"darwin", map[string]string{"HOME": "/Users/a"}, "/Users/a/Library/Application Support/equori"},
		{"linux", map[string]string{}, ""},
		{"windows", map[string]string{"HOME": "C:/a"}, ""},
	}
	for _, tt := range tests {
		if got := DefaultDataDir(tt.goos, env(tt.env)); got != tt.want {
			t.Errorf("DefaultDataDir(%q, %v) = %q, want %q", tt.goos, tt.env, got, tt.want)
		}
	}
}
```

`config_test.go`: rename case `"missing database url"` to `"missing database url and data directory"` (still `wantErr: true`; its env map has no `HOME`, so on Linux and macOS no default exists). Add:

```go
		{
			name: "managed with explicit directories",
			env:  map[string]string{"EQUORI_DATA_DIR": "/srv/equori", "EQUORI_POSTGRES_BIN": "/usr/lib/postgresql/18/bin"},
			want: Config{
				DataDir: "/srv/equori", BackupDir: "/srv/equori/backups", PostgresBin: "/usr/lib/postgresql/18/bin",
				HTTPAddr: ":8080", LogLevel: slog.LevelInfo, TimeZone: time.Local,
				SyncInterval: time.Hour, GeminiURL: "https://generativelanguage.googleapis.com",
			},
		},
		{
			name: "managed with a backup directory",
			env:  map[string]string{"EQUORI_DATA_DIR": "/srv/equori", "EQUORI_BACKUP_DIR": "/mnt/backups"},
			want: Config{
				DataDir: "/srv/equori", BackupDir: "/mnt/backups",
				HTTPAddr: ":8080", LogLevel: slog.LevelInfo, TimeZone: time.Local,
				SyncInterval: time.Hour, GeminiURL: "https://generativelanguage.googleapis.com",
			},
		},
```

- [ ] **Step 2: Run** `go test ./internal/platform/config/`
Expected: build failures (`ReadEnvFile`, `WithFile`, `DefaultDataDir`, fields).

- [ ] **Step 3: Implement.** `ReadEnvFile`: `os.ReadFile`; `fs.ErrNotExist` → empty map; for each line (1-based number `n`): `strings.TrimSpace`; skip empty and `#`-prefixed lines; `key, value, ok := strings.Cut(line, "=")`; `key = strings.TrimSpace(key)`, `value = strings.TrimSpace(value)`; `!ok` or a key not matching `^[A-Z_][A-Z0-9_]*$` → `fmt.Errorf("%s line %d: want KEY=VALUE with KEY in upper case", path, n)`. `DefaultDataDir` uses `path.Join` with forward slashes for the expected strings above. In `Load`, replace the `EQUORI_DATABASE_URL is not set` check with the managed branch of the interface block.

- [ ] **Step 4: Run** `go test ./internal/platform/config/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/platform/config
git commit -m "feat(platform): configure managed mode and read equori.env" -m "Without EQUORI_DATABASE_URL the configuration names a data directory,
the per-user default of Linux or macOS when unset. equori.env in that
directory holds settings a Homebrew service cannot keep in its
environment; the process environment wins (ADR 021, M1 and C2)."
```

---

### Task 6: Generated secret key (C3)

**Files:**
- Create: `internal/platform/secret/key_file.go`
- Test: `internal/platform/secret/key_file_test.go`

**Interfaces:**
- Produces: `func LoadOrCreateKey(path string) (string, error)`: returns the 32 raw key bytes as a string (the form of `config.Config.SecretKey`). The file holds standard base64 and a newline, mode 0600, created with `O_EXCL`.

- [ ] **Step 1: Write the failing tests**

```go
func TestLoadOrCreateKey(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "data", "secret.key")
	first, err := LoadOrCreateKey(path)
	if err != nil || len(first) != 32 {
		t.Fatalf("first call: %d bytes, %v", len(first), err)
	}
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("mode = %v, %v; want 0600", info.Mode().Perm(), err)
	}
	second, err := LoadOrCreateKey(path)
	if err != nil || second != first {
		t.Fatal("second call returned another key")
	}
	raw, _ := os.ReadFile(path)
	if strings.TrimSpace(string(raw)) != base64.StdEncoding.EncodeToString([]byte(first)) {
		t.Fatalf("file = %q", raw)
	}
}

func TestLoadOrCreateKeyRejectsAShortKey(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "secret.key")
	if err := os.WriteFile(path, []byte(base64.StdEncoding.EncodeToString(make([]byte, 16))+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadOrCreateKey(path); err == nil {
		t.Fatal("a 16-byte key: want an error")
	}
}
```

- [ ] **Step 2: Run** `go test ./internal/platform/secret/` — Expected: FAIL, undefined `LoadOrCreateKey`.
- [ ] **Step 3: Implement.** Read; on `fs.ErrNotExist`: `os.MkdirAll(filepath.Dir(path), 0o700)`, `crypto/rand.Read` 32 bytes, `os.OpenFile(path, O_CREATE|O_EXCL|O_WRONLY, 0o600)`, write base64 and `\n`. On read: decode `strings.TrimSpace`; a length other than 32 → `fmt.Errorf("%s must hold 32 bytes in standard base64", path)`. Comment: `// LoadOrCreateKey keeps the key of managed mode beside the data and outside every dump (ADR 008, K2).`
- [ ] **Step 4: Run** `go test ./internal/platform/secret/` — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add internal/platform/secret
git commit -m "feat(platform): generate the secret key of managed mode" -m "A managed instance without EQUORI_SECRET_KEY creates secret.key once,
mode 0600, beside the data and outside every dump (ADR 021, C3)."
```

---

### Task 7: Wire managed mode into `equori`

**Files:**
- Create: `cmd/equori/database.go` (moves `openDatabase` out of `main.go`)
- Create: `cmd/equori/backup.go` (`backup` and `restore` commands, periodic backup)
- Modify: `cmd/equori/main.go` (`setup`, `serve`, command switch, usage line)
- Modify: `cmd/equori/secrets.go` (`secrets key`)
- Modify: every caller of `openDatabase` (`main.go`, `user.go`, `secrets.go`)

**Interfaces:**
- Consumes: Tasks 2 to 6; `postgres.Open`, `postgres.Migrate`, `postgres.LatestVersion`, `postgres.ErrSchemaAhead` (F1).
- Produces:

```go
type database struct {
	Pool    *pgxpool.Pool
	Cluster *pgcluster.Cluster // nil in external mode
	DSN     string             // connection string for pg_dump and pg_restore
}

// openDatabase attaches (or, for serve, starts) the managed server, backs up before pending
// migrations in managed mode, and migrates.
func openDatabase(ctx context.Context, cfg config.Config, log *slog.Logger, serving bool) (*database, error)
func (d *database) Close(log *slog.Logger)
func postgresBin(cfg config.Config, d *database) (string, error) // the cluster's programs, else pgcluster.Bin(cfg.PostgresBin)
```

- [ ] **Step 1: `setup()`** reads `equori.env` and the key file:

```go
func setup() (config.Config, *slog.Logger, error) {
	getenv := os.Getenv
	if getenv("EQUORI_DATABASE_URL") == "" {
		if dir := cmp.Or(getenv("EQUORI_DATA_DIR"), config.DefaultDataDir(runtime.GOOS, getenv)); dir != "" {
			file, err := config.ReadEnvFile(filepath.Join(dir, "equori.env"))
			if err != nil {
				return config.Config{}, nil, err
			}
			getenv = config.WithFile(getenv, file)
		}
	}
	cfg, err := config.Load(getenv)
	if err != nil {
		return config.Config{}, nil, err
	}
	if cfg.Managed() && cfg.SecretKey == "" {
		if cfg.SecretKey, err = secret.LoadOrCreateKey(filepath.Join(cfg.DataDir, "secret.key")); err != nil {
			return config.Config{}, nil, err
		}
	}
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel}))
	return cfg, log, nil
}
```

`aggregatorURLs(os.Getenv)` in `serverConfig` keeps reading the process environment; leave it.

- [ ] **Step 2: `openDatabase`** in `database.go`:

```go
func openDatabase(ctx context.Context, cfg config.Config, log *slog.Logger, serving bool) (*database, error) {
	if !cfg.Managed() {
		pool, err := postgres.Open(ctx, cfg.DatabaseURL)
		if err != nil {
			return nil, err
		}
		if err := postgres.Migrate(ctx, pool, log); err != nil {
			pool.Close()
			return nil, err
		}
		return &database{Pool: pool, DSN: cfg.DatabaseURL}, nil
	}
	bin, err := pgcluster.Bin(cfg.PostgresBin)
	if err != nil {
		return nil, err
	}
	open := pgcluster.Attach
	if serving {
		open = pgcluster.Start
	}
	cluster, err := open(ctx, cfg.DataDir, bin)
	if err != nil {
		return nil, err
	}
	d := &database{Cluster: cluster, DSN: cluster.DSN(pgcluster.Database)}
	if d.Pool, err = postgres.Open(ctx, d.DSN); err != nil {
		cluster.Stop()
		return nil, err
	}
	if err := d.migrateManaged(ctx, cfg, log); err != nil {
		d.Close(log)
		return nil, err
	}
	return d, nil
}

// migrateManaged takes the pre-migration backup of B3, then migrates; a schema ahead of the binary
// names the newest pre-migration backup (V4).
func (d *database) migrateManaged(ctx context.Context, cfg config.Config, log *slog.Logger) error {
	current, pending, err := postgres.Pending(ctx, d.Pool)
	if err != nil {
		return err
	}
	if pending {
		path := filepath.Join(cfg.BackupDir, backup.Name(backup.PreMigration, time.Now().In(cfg.TimeZone), current))
		if err := backup.Dump(ctx, d.Cluster.Bin(), d.DSN, path); err != nil {
			return fmt.Errorf("back up before migrating: %w", err)
		}
		log.Info("backup before migrations", "path", path)
		if err := backup.Prune(cfg.BackupDir, backup.PreMigration, 3); err != nil {
			return err
		}
	}
	err = postgres.Migrate(ctx, d.Pool, log)
	if errors.Is(err, postgres.ErrSchemaAhead) {
		if newest, nerr := backup.Newest(cfg.BackupDir, backup.PreMigration); nerr == nil && newest != "" {
			return fmt.Errorf("%w; newest pre-migration backup: %s (equori restore %s)", err, newest, newest)
		}
	}
	return err
}

func (d *database) Close(log *slog.Logger) {
	if d.Pool != nil {
		d.Pool.Close()
	}
	if d.Cluster != nil {
		if err := d.Cluster.Stop(); err != nil {
			log.Error("stop postgres", "error", err)
		}
	}
}
```

Replace every `pool, err := openDatabase(ctx, cfg, log)` / `defer pool.Close()` pair with `db, err := openDatabase(ctx, cfg, log, false)` / `defer db.Close(log)`, and use `db.Pool` where `pool` was used. In `serve`, pass `true`.

- [ ] **Step 3: `serve`** additions, in this order after `openDatabase`:
  1. B7: `provider, locale, err := postgres.Locale(ctx, db.Pool)`; on error return it; when `provider != "b" || locale != "C.UTF-8"`, `log.Warn("text order follows the database host's locale; equori restore of a backup recreates the database with the builtin C.UTF-8 order", "provider", provider, "locale", locale)`.
  2. Child watch (M6), only when `db.Cluster != nil`:

```go
	postgresExit := make(chan error, 1)
	if db.Cluster != nil {
		go func() {
			select {
			case <-db.Cluster.Exited():
				postgresExit <- fmt.Errorf("postgres exited: %w", db.Cluster.ExitErr())
				stop()
			case <-ctx.Done():
			}
		}()
	}
```

  3. Periodic backup (B3), only when `db.Cluster != nil`, a goroutine that the existing deferred block waits for like `planningDone`:

```go
	backupsDone := make(chan struct{})
	go func() {
		defer close(backupsDone)
		if db.Cluster != nil {
			runPeriodicBackups(ctx, db, cfg, log)
		}
	}()
```

  4. The final line becomes:

```go
	err = httpserver.Run(ctx, cfg.HTTPAddr, app.Handler, log)
	select {
	case perr := <-postgresExit:
		return perr
	default:
		return err
	}
```

`stop` is the `signal.NotifyContext` cancel function already in `serve`; `ctx` must be that context. The deferred block also waits `<-backupsDone`. `db.Close(log)` stays deferred first, so it runs last, after HTTP and every goroutine.

- [ ] **Step 4: `backup.go`** in `cmd/equori`:

```go
const backupUsage = `usage: equori backup [--out FILE]
       equori restore FILE

backup writes a pg_dump archive; restore replaces the database with one.
In managed mode, restore refuses to run while equori serve runs.`

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
```

`backupCommand(args []string) error`: flags `--out`; `setup`; `openDatabase(ctx, cfg, log, false)`; `bin, err := postgresBin(cfg, db)`; default path `filepath.Join(cfg.BackupDir, name)` in managed mode and `name` (current directory) in external mode, where `name := backup.Name(backup.Manual, time.Now().In(cfg.TimeZone), latest)`; `backup.Dump`; print `path` on stdout and, on stderr, `the dump holds no secret key; equori secrets key prints the key in use`.

`restoreCommand(args []string) error`: exactly one argument, else print `backupUsage` and return `errUsage`. `setup`. Managed: `c, err := pgcluster.Attach(ctx, cfg.DataDir, bin)`; when `!c.Owned()`: `c.Stop()` and return `errors.New("equori serve is running on this data directory; stop it, then run equori restore again")`; else `defer c.Stop()` and `backup.Restore(ctx, c.Bin(), c.DSN(pgcluster.Database), file, latest)`. External: `bin := pgcluster.Bin(cfg.PostgresBin)` and `backup.Restore(ctx, bin, cfg.DatabaseURL, file, latest)`. Restore never calls `openDatabase`, which would migrate before the drop. Print `restored <file>; the next start applies newer migrations`.

`postgresBin`: `d.Cluster.Bin()` when the cluster exists, else `pgcluster.Bin(cfg.PostgresBin)`.

Register `case "backup": err = backupCommand(os.Args[2:])` and `case "restore": err = restoreCommand(os.Args[2:])` in `main`, and add both names to the `available:` list of the unknown-command message.

- [ ] **Step 5: `secrets key`.** In `secretsCommand`, accept `key` besides `rotate`: `setup`; when `cfg.SecretKey == ""`, return `errors.New("no secret key is configured: set EQUORI_SECRET_KEY")`; otherwise print `base64.StdEncoding.EncodeToString([]byte(cfg.SecretKey))`. Update `rotateUsage` to list `equori secrets key`.

- [ ] **Step 6: Build and run the existing tests**

Run: `go build ./... && go test ./cmd/equori/ ./internal/platform/... && make lint`
Expected: PASS, no lint finding.

- [ ] **Step 7: Run external mode against the dev database**

Run: `make db-up && (set -a; . ./dev.env; set +a; go run ./cmd/equori backup --out /tmp/claude-equori.dump && ls -l /tmp/claude-equori.dump)`
Expected: the path printed, a file with mode `-rw-------`. The `make db-up` server is `postgres:18-alpine`; the host needs `pg_dump` 18 on `PATH` or `EQUORI_POSTGRES_BIN`. Without it, the command fails with the `find postgres on PATH` message, which is the expected behavior; record it and continue, because Task 9 covers managed mode in the image.

- [ ] **Step 8: Commit**

```bash
git add cmd/equori
git commit -m "feat(platform): run equori in managed mode with backup and restore" -m "Without EQUORI_DATABASE_URL, serve starts its own PostgreSQL server
and exits when it dies; other commands attach to it. A backup precedes
pending migrations and runs daily while serving; equori backup,
equori restore and equori secrets key complete the commands (ADR 021,
D2 to D4)."
```

---

### Task 8: A dump restores across forms (B4)

**Files:**
- Create: `internal/server/cluster_backup_test.go` (`//go:build cluster`)
- Modify: `Makefile` (`CLUSTER_TESTS` gains `internal/server:^TestCluster`)

**Interfaces:**
- Consumes: `snapshot(t, pool)` and the harness setup of `TestRestoredBackupMatchesTheOriginal` in `internal/server/backup_test.go`; `backup.Dump`, `backup.Restore` (Task 3); `pgcluster.Start` (Task 2); `postgres.Open`, `postgres.Migrate`, `postgres.LatestVersion`.

- [ ] **Step 1:** Append `internal/server:^TestCluster` to `CLUSTER_TESTS` in the Makefile.

- [ ] **Step 2: Write the test**

```go
//go:build cluster

package server_test

// B4 of the distribution design: a dump of the compose form restores into a managed cluster and
// back, with every fact and derived value of N12.
func TestClusterBackupRestoresAcrossForms(t *testing.T) {
	bin := os.Getenv("EQUORI_TEST_POSTGRES_BIN")
	if bin == "" {
		t.Fatal("EQUORI_TEST_POSTGRES_BIN is not set; run make test-cluster")
	}
	h := apitest.New(t, apitest.Today("2026-11-20"))
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-14", apitest.Posting(checking, -23000), apitest.Posting(food, 23000))
	h.Dispatch()
	want := snapshot(t, h.Pool)
	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}
	external := dsnOf(h.Pool)

	dump := filepath.Join(t.TempDir(), "compose.dump")
	if err := backup.Dump(t.Context(), bin, external, dump); err != nil {
		t.Fatal(err)
	}
	c, err := pgcluster.Start(t.Context(), t.TempDir(), bin)
	if err != nil {
		t.Fatal(err)
	}
	defer c.Stop()
	if err := backup.Restore(t.Context(), bin, c.DSN(pgcluster.Database), dump, latest); err != nil {
		t.Fatal(err)
	}
	managed, err := postgres.Open(t.Context(), c.DSN(pgcluster.Database))
	if err != nil {
		t.Fatal(err)
	}
	defer managed.Close()
	if got := snapshot(t, managed); !slices.Equal(got, want) {
		t.Fatalf("compose to managed differs:\n got %v\nwant %v", got, want)
	}

	back := filepath.Join(t.TempDir(), "managed.dump")
	if err := backup.Dump(t.Context(), bin, c.DSN(pgcluster.Database), back); err != nil {
		t.Fatal(err)
	}
	target := pgtest.Empty(t)
	if err := backup.Restore(t.Context(), bin, dsnOf(target), back, latest); err != nil {
		t.Fatal(err)
	}
	target.Reset()
	if got := snapshot(t, target); !slices.Equal(got, want) {
		t.Fatalf("managed to compose differs:\n got %v\nwant %v", got, want)
	}
}
```

Add the helper below to the same file. `ConnConfig.ConnString()` returns the string given to `ParseConfig`, which names the server's maintenance database, not the database pgtest created; the helper builds the string from the fields.

```go
func dsnOf(pool *pgxpool.Pool) string {
	cc := pool.Config().ConnConfig
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable", cc.Host, cc.Port, cc.User, cc.Password, cc.Database)
}
```

`Restore` drops and recreates the database of `target` with `WITH (FORCE)`, which ends the pool's connections; `target.Reset()` discards them so `snapshot` opens new ones. If `pgtest.Empty` registers a cleanup that drops the database, that cleanup still works on the recreated database of the same name.

- [ ] **Step 3: Run** `make test-cluster`
Expected: `TestClusterBackupRestoresAcrossForms` PASS. If `Restore` fails with `permission denied to create database` on the test server, the URL's role lacks `CREATEDB`; the test server's role `equori` is the image's superuser, so this failure means the URL points elsewhere: print `external` and stop.

- [ ] **Step 4: Commit**

```bash
git add internal/server/cluster_backup_test.go Makefile
git commit -m "test(platform): restore a dump across compose and managed mode" -m "B4 of the distribution design: the dump of each form restores into
the other with the facts, balances, daily series, triggers and
attachments of N12."
```

---

### Task 9: Standalone image, compose locale and smoke test

**Files:**
- Modify: `Dockerfile` (stage `standalone` before the final stage)
- Modify: `compose.yaml` (`db.environment.POSTGRES_INITDB_ARGS`)
- Create: `scripts/standalone-smoke.sh` (mode 0755)
- Modify: `Makefile` (target `standalone-smoke`)
- Modify: `.github/workflows/ci.yml` (job `image`), `.github/workflows/release.yml` (job `image`)

**Interfaces:**
- Produces: image target `standalone`; tags `X.Y.Z-standalone`, `X.Y-standalone`, `standalone` on release.

- [ ] **Step 1: Dockerfile.** Insert between the `build` stage and the final `FROM gcr.io/distroless/...`:

```dockerfile
# Application and PostgreSQL in one container (ADR 021, M10): equori runs the server of the base
# image as its child. Built with --target standalone; the default target stays the application alone.
FROM postgres:18 AS standalone
COPY --from=build /out/equori /usr/local/bin/equori
ENV EQUORI_DATA_DIR=/data EQUORI_POSTGRES_BIN=/usr/lib/postgresql/18/bin
RUN mkdir -p /data && chown postgres:postgres /data
USER postgres
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD ["equori", "healthcheck"]
ENTRYPOINT ["equori"]
CMD ["serve"]
```

- [ ] **Step 2: compose.yaml.** Under `services.db.environment`, add `POSTGRES_INITDB_ARGS: "--locale-provider=builtin --builtin-locale=C.UTF-8"` with the comment `# B5: a new volume orders text by code point, as managed mode does; an existing volume keeps its order.`

- [ ] **Step 3: Write `scripts/standalone-smoke.sh`**

```bash
#!/usr/bin/env bash
# Smoke test of the standalone image (ADR 021, M6, M7, B1, B2, C3).
set -euo pipefail
image=${1:?usage: $0 IMAGE}
name=equori-smoke-$$
port=18081
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; docker volume rm "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

healthy() {
	for _ in $(seq 90); do
		[[ "$(docker inspect -f '{{.State.Health.Status}}' "$name")" == healthy ]] && return 0
		sleep 1
	done
	docker logs "$name" >&2
	return 1
}

docker volume create "$name" >/dev/null
docker run -d --name "$name" -v "$name:/data" -p "127.0.0.1:$port:8080" "$image" >/dev/null
healthy
echo "1 started"
docker exec "$name" equori version | head -1
printf '%s\n' equori-smoke-test | docker exec -i "$name" equori user create --email smoke@equori.test --language en --region US
echo "2 a command attached to the running server"
docker exec "$name" equori backup | grep -E '^/data/backups/equori-[0-9-]+-s[0-9]+\.dump$'
echo "3 backup written"
[[ "$(docker exec "$name" equori secrets key | tr -d '\n' | wc -c)" == 44 ]]
echo "4 secret key generated"
[[ "$(docker exec "$name" psql "host=/data/run user=equori dbname=equori" -Atc "SELECT datlocprovider::text || ' ' || datlocale FROM pg_database WHERE datname = 'equori'")" == "b C.UTF-8" ]]
echo "5 builtin C.UTF-8 order"
if docker exec "$name" equori restore /data/backups/"$(docker exec "$name" ls /data/backups | head -1)" 2>"/tmp/$name.err"; then
	echo "restore ran beside serve" >&2
	exit 1
fi
grep -q 'stop it, then run equori restore again' "/tmp/$name.err"
echo "6 restore refused beside serve"
docker restart "$name" >/dev/null
healthy
echo "7 clean restart"
docker kill -s KILL "$name" >/dev/null
docker start "$name" >/dev/null
healthy
echo "8 restart after SIGKILL"
```

The test data uses `--language en --region US` as fixed test input; it is not an application default.

- [ ] **Step 4: Makefile**

```make
standalone-smoke:
	docker build --target standalone -t equori:standalone .
	scripts/standalone-smoke.sh equori:standalone
```

Add to `.PHONY`.

- [ ] **Step 5: Run** `make standalone-smoke`
Expected: lines `1 started` to `8 restart after SIGKILL`, exit status 0.

- [ ] **Step 6: CI.** In `.github/workflows/ci.yml`, job `image`, add after the existing build step:

```yaml
      - uses: docker/build-push-action@v6
        with:
          context: .
          target: standalone
          load: true
          tags: equori:standalone
      - run: scripts/standalone-smoke.sh equori:standalone
```

- [ ] **Step 7: Release.** In `.github/workflows/release.yml`, job `image`, add a second metadata step `meta-standalone` with tags

```yaml
          tags: |
            type=semver,pattern={{version}},suffix=-standalone
            type=semver,pattern={{major}}.{{minor}},suffix=-standalone
            type=raw,value=standalone,enable=${{ !contains(github.ref_name, '-') }}
```

then: a `load: true` build of `target: standalone` tagged `equori:standalone`, `run: scripts/standalone-smoke.sh equori:standalone`, a multi-platform push build of `target: standalone` with `id: push-standalone` and the `meta-standalone` tags and labels, and an `actions/attest-build-provenance@v4` step with `subject-digest: ${{ steps.push-standalone.outputs.digest }}`. Validate with the `actionlint` command of F1 Task 7 Step 2.

- [ ] **Step 8: Commit**

```bash
git add Dockerfile compose.yaml scripts/standalone-smoke.sh Makefile .github/workflows/ci.yml .github/workflows/release.yml
git commit -m "build: ship a standalone image with its own postgres" -m "One container holds equori and the PostgreSQL programs of postgres:18;
equori runs the server as its child over /data. A smoke test covers
start, attached commands, backup, the generated key, the builtin
order, the refusal of restore beside serve and restarts after a clean
stop and after SIGKILL. New compose volumes order text the same way
(ADR 021, M10, B5)."
```

---

### Task 10: Documents of F2

**Files:**
- Modify: `docs/adr/021-distribution.md` (D2, D3, D4 rules, copied from the spec)
- Modify: `docs/adr/001-postgres-database.md` (dated amendment)
- Modify: `docs/adr/008-integration-credentials.md` (dated amendment K6)
- Modify: `docs/operations/backup.md` (rewrite per B6)
- Modify: `docs/domain/08-non-functional-requirements.md` (N12 verification row; new N28)
- Modify: `README.md` (standalone image; variables `EQUORI_DATA_DIR`, `EQUORI_POSTGRES_BIN`, `EQUORI_BACKUP_DIR`; command list)
- Modify: `CLAUDE.md` (Commands: `make test-cluster`, `make standalone-smoke`; Layout: `internal/platform/pgcluster`, `internal/platform/backup` need no row because `internal/platform/` covers them)

- [ ] **Step 1: ADR 021.** Append the tables M1 to M10, C1 to C4 and B1 to B7 from the spec, verbatim, and the "Settled during planning" table.
- [ ] **Step 2: ADR 001.** Add `## Amendment of 2026-10-26 (ADR 021)` with three bullets: managed mode runs PostgreSQL as a child of `equori` (`internal/platform/pgcluster`); the minimum major is 18 (`uuidv7()`); major upgrades stay the host's responsibility for compose and follow ADR 021 V6 for managed mode.
- [ ] **Step 3: ADR 008 integration credentials.** Add a row `| K6 | Amendment of 2026-10-26. In managed mode without EQUORI_SECRET_KEY, the first start writes 32 random bytes in standard base64 to secret.key in the data directory, mode 0600, outside every dump; equori secrets key prints the key in use. Reason: a Homebrew service or a standalone container has no place for a key the owner would have to generate first (ADR 021, C3). |`.
- [ ] **Step 4: backup.md.** Sections: `## Backup` (`equori backup`, default locations per mode, the compose `exec db pg_dump` variant kept for compose); `## Automatic backups` (B3: before pending migrations, daily, retention, `EQUORI_BACKUP_DIR`; same disk as the data, so copy them elsewhere); `## Restore` (`equori restore FILE` with `serve` stopped; for compose, the existing `pg_restore` commands with `createdb --template=template0 --locale-provider=builtin --builtin-locale=C.UTF-8 -U equori equori` replacing `createdb -U equori equori`); `## Moving between forms` (B4); `## Secret key` (the existing paragraph plus `equori secrets key`). Keep the Verification section and add `TestClusterBackupRestoresAcrossForms`.
- [ ] **Step 5: NFR.** Add to section 8.8: `| N28 | A dump of each form restores into each other form with every fact (ADR 021, B4); verified by \`TestClusterBackupRestoresAcrossForms\`. |`.
- [ ] **Step 6: README.** Under `## Run`, a subsection `### One container` with `docker run -d --name equori -p 8080:8080 -v equori:/data ghcr.io/andrelopes-code/equori:<version>-standalone` and `docker exec -it equori equori user create --email you@example.com --language <code> --region <country> --admin`. Add the three variables to the table with defaults `per-user data directory`, `directory of postgres on PATH`, `<data directory>/backups`.
- [ ] **Step 7: CLAUDE.md** Commands rows: `| \`make test-cluster\` | Managed-mode tests (build tag \`cluster\`) inside \`postgres:18\`; \`make check\` runs it |` and `| \`make standalone-smoke\` | Builds and checks the standalone image |`.
- [ ] **Step 8: Commit**

```bash
git add docs README.md CLAUDE.md
git commit -m "docs: record managed mode, backups and the standalone image" -m "ADR 021 gains the managed-mode, configuration and backup rules;
ADR 001 and ADR 008 gain dated amendments; the backup guide covers
equori backup and restore, automatic backups and moving between
forms; N28 names the cross-form restore."
```

---

### Task 11: Phase gate

- [ ] **Step 1:** `make check` — Expected: exit status 0 (includes `test-cluster`).
- [ ] **Step 2:** `make standalone-smoke` — Expected: exit status 0.
- [ ] **Step 3:** `make upgrade-test` — Expected: exit status 0.
- [ ] **Step 4:** Update `.claude/progress/current.md` (all required fields); next action: `start docs/superpowers/plans/2026-10-26-distribution-f3-homebrew.md Task 1`.
