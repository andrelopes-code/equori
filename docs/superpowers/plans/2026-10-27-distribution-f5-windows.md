# Distribution F5: Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed Inno Setup installer puts `equori.exe`, a bundled PostgreSQL 18 and a Windows service on Windows 10 and 11. The browser then opens on a first-user screen, which every form gains.

**Architecture:** `internal/platform/pgcluster` splits its platform code into `platform_unix.go` and `platform_windows.go` (lock, DACL, restricted token, Job Object, stop through `pg_ctl`); the rest of the package becomes platform-neutral. A new package `internal/platform/winsvc` runs `serve` under the service manager and installs the service. The identity module gains a token-gated setup endpoint, and the web application gains `/setup`. CI and the release gain a `windows-latest` job that builds the bundle from the pinned EDB zip, runs the tests, builds the installer and smoke-tests it.

**Tech Stack:** Go 1.27, `golang.org/x/sys/windows` and `windows/svc` (v0.49.0, already in `go.sum`), pgx v5, EDB PostgreSQL 18.6-5 binaries, Inno Setup 6, PowerShell 7, GitHub Actions `windows-latest`, Azure Artifact Signing, React with `@slotted/react`.

**Spec:** `docs/superpowers/specs/2026-10-27-distribution-windows-design.md` (rules W-*, measurements S1 to S19), amending `docs/superpowers/specs/2026-10-26-distribution-design.md`.

**Requires:** F1 to F4 complete (checkpoint of 2026-10-26). The owner's commit holding the files that `fef50c1` imports exists, so `make check` passes on a clean tree.

## Global Constraints

- No `runtime.GOOS` branch in `pgcluster`, `backup`, `cmd/equori` or any module. Platform code sits in files named `*_unix.go` (`//go:build unix`) and `*_windows.go`. `config.DefaultDataDir` keeps its existing `goos` parameter.
- `golang.org/x/sys` moves to the direct `require` block; no other new module (spec W9).
- PostgreSQL pin (`packaging/windows/postgresql.env`): `PG_VERSION=18.6-5`, `PG_URL=https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64-binaries.zip`, `PG_SHA256=e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2`.
- Bundle contents: exactly W-P2 of the spec.
- Windows server flags are those of Unix: `-D <dir>\pg -k <dir>\run -c listen_addresses= -c max_connections=50`; `pg_hba.conf` is `local all all trust\n`.
- Windows socket path limit: 107 bytes, no fallback; the error names `EQUORI_DATA_DIR`.
- DACL of a created data directory: SDDL `D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;<account SID>)…`. Accepted allow-entry SIDs: `S-1-5-18`, `S-1-5-32-544`, `S-1-3-0`, `S-1-5-80-*`, `S-1-5-21-*`.
- Restricted token: `CreateRestrictedToken(token, DISABLE_MAX_PRIVILEGE, [S-1-5-32-544, S-1-5-32-547], …)` plus the process account added to `TokenDefaultDacl` with `GENERIC_ALL`.
- Service: name `equori`, account `NT SERVICE\equori`, SID type unrestricted, automatic start, recovery restart after 5 s, reset period 86400 s.
- Windows data directory `%ProgramData%\equori`; HTTP address `127.0.0.1:8080` written to `equori.env` by `service install`.
- Setup: problem codes `setup_token_invalid` (403) and `setup_complete` (409); token 32 bytes base64url; URL `http://<host>:<port>/setup#token=<token>`; file `setup.url`.
- Installer name `equori_X.Y.Z_windows_amd64_setup.exe`; `MinVersion=10.0.17134`.
- Documentation examples use placeholders for regional values (`--language <code> --region <country>`).
- Agents never run Windows-only tests locally; they push branch `f5-windows` (authorized in Task 0) and read the `windows` job with `gh run watch`.
- Steps marked **Owner** change something outside the repository or need a real device. An agent stops at them and reports.
- Every rule of `CLAUDE.md` and `web/CLAUDE.md` applies. The owner's uncommitted edits under `web/` and `docs/slotted-findings.md` are never staged; a web task stages only its own hunks.

## Review Focus

1. An administrator opens a terminal "as administrator" and runs `equori backup` while the service is stopped: the temporary server must start under the restricted token, not fail with the PostgreSQL administrator refusal. Covered by the `windows` job running elevated (Task 5) and by `TestClusterBackupDoesNotMigrate` there.
2. `EQUORI_DATA_DIR` set to a folder under `C:\Users\Public` or another folder that grants `Users`: the start must refuse and name the SID. `TestPrivateDirRefusesUsersGroup` (Task 4).
3. Port 8080 already taken on the PC: the service fails, restarts every 5 s, and the browser shows nothing. `main` prints the listen error (`listen tcp 127.0.0.1:8080: bind: …`) to standard error, which service mode sends to `equori.log` (Task 7). Smoke step "port taken" (Task 10) requires that line; the README names `equori.env` as the place to change the port (Task 12).
4. A second POST of the setup form after a success, or a stale `setup.url` after `equori user create`: 409 and the login screen, never a second admin. Tests in Task 8.
5. An upgrade installer started while the service runs: files are locked unless the service stops first. Smoke step "install over the running version" (Task 10).

---

### Task 0: Owner preparation (Owner)

- [ ] **Step 1 (Owner):** Commit the files that `fef50c1` references; `make check` passes in a clean worktree of `main`.
- [ ] **Step 2 (Owner):** Authorize pushing branch `f5-windows` to `origin` for the CI runs of this plan. Pushing reveals the 43 local commits of `main` that `origin` lacks. Reply "push f5-windows authorized" or push `main` first.
- [ ] **Step 3 (Owner):** Start the Azure Artifact Signing identity validation (spec F14: individual in the USA or Canada, or an organization in the USA, Canada, the EU or the UK). On approval, create an account and a certificate profile, an app registration holding the signer role on that profile, as the Azure Artifact Signing quickstart names it, and set the secrets `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `ARTIFACT_SIGNING_ENDPOINT`, `ARTIFACT_SIGNING_ACCOUNT`, `ARTIFACT_SIGNING_PROFILE` with `gh secret set`. When the owner is not eligible, stop: the spec's revisit criterion "Another signing provider" applies, and Task 11 waits.
- [ ] **Step 4:** An agent checks Step 1 with `git worktree add` of `main` and `make check` there. Expected: exit 0. Otherwise stop and report.

---

### Task 1: Program resolution with `.exe` and the bundled directory (W-M2)

**Files:**
- Modify: `internal/platform/pgcluster/program.go`
- Test: `internal/platform/pgcluster/program_test.go`

**Interfaces:**
- Produces: `func Bin(explicit string) (string, error)` (signature unchanged), backed by `func bin(explicit, exe string) (string, error)`, where `exe` is the path of the running executable (`os.Executable()`). Order: `explicit`; `filepath.Join(filepath.Dir(exe), "postgresql", "bin")` when it holds `postgres`; the directory of `postgres` on `PATH`. "Holds `postgres`" means `exec.LookPath(filepath.Join(dir, "postgres"))` returns no error.

- [ ] **Step 1: Write the failing tests** in `program_test.go`:
  - `TestBinBesideExecutable`: `exe := filepath.Join(root, "equori")`, an executable file `root/postgresql/bin/postgres` (mode 0755), `PATH` set to an empty directory with `t.Setenv`; `bin("", exe)` returns `root/postgresql/bin`.
  - `TestBinExplicitWins`: both an explicit directory and the beside-executable directory hold `postgres`; `bin(explicit, exe)` returns `explicit`.
  - `TestBinExplicitNotExecutable` (`program_unix_test.go`, `//go:build unix`): a `postgres` file with mode 0644; `Bin(dir)` returns an error containing `EQUORI_POSTGRES_BIN`.
- [ ] **Step 2: Run** `go test ./internal/platform/pgcluster/ -run 'TestBin' -v`. Expected: FAIL, `undefined: bin`.
- [ ] **Step 3: Implement** `bin` in `program.go` and make `Bin` call it with `os.Executable()`; an `os.Executable` error falls through to `PATH`. The error message of an explicit directory keeps `EQUORI_POSTGRES_BIN %s: %w`.
- [ ] **Step 4: Run** `go test ./internal/platform/pgcluster/ -v`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(platform): resolve postgres.exe and the bundled programs directory`, body naming W-M2 and the defect "`equori backup` fails on Windows".

---

### Task 2: Default data directory on Windows (W-M1)

**Files:**
- Modify: `internal/platform/config/data_dir.go`
- Test: `internal/platform/config/data_dir_test.go`

**Interfaces:**
- Produces: `DefaultDataDir("windows", getenv)` returns `getenv("ProgramData") + "\equori"`, or `""` when `ProgramData` is empty. `HOME` is not read for Windows.

- [ ] **Step 1: Add table cases** to `TestDefaultDataDir`: `{goos: "windows", env: {"ProgramData": `C:\ProgramData`}, want: `C:\ProgramData\equori`}`; `{goos: "windows", env: {"ProgramData": `C:\ProgramData`, "HOME": ""}, want: `C:\ProgramData\equori`}`; `{goos: "windows", env: {}, want: ""}`.
- [ ] **Step 2: Run** `go test ./internal/platform/config/ -run TestDefaultDataDir -v`. Expected: FAIL on the first two cases (`""`).
- [ ] **Step 3: Implement** the `windows` case before the `HOME` check, joining with a backslash (the function runs on Linux in tests, so `path/filepath` would join with `/`).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(platform): default data directory under ProgramData on windows`.

---

### Task 3: Split the Unix platform code of pgcluster (no behavior change)

**Files:**
- Create: `internal/platform/pgcluster/platform_unix.go` (`//go:build unix`), `internal/platform/pgcluster/platform_unix_test.go`, `internal/platform/pgcluster/socket_unix_test.go`
- Modify: `internal/platform/pgcluster/pgcluster.go`, `program.go`, `socket.go`
- Delete: `internal/platform/pgcluster/owner_unix.go`
- Move: `TestRefuseRoot` from `program_test.go` to `platform_unix_test.go`; `TestSocketDir`, `TestEnsurePrivateDirCreates`, `TestEnsurePrivateDirRefusesForeignMode` from `socket_test.go` to `socket_unix_test.go`.

**Interfaces:**
- Produces, in `platform_unix.go`, the set that Task 4 and Task 5 implement for Windows with the same signatures:
  - `const socketLimit = 103`
  - `func socketFallback(abs string) (string, error)`: `<os.TempDir()>/equori-<first 12 hex of SHA-256 of abs>`.
  - `func lockFile(f *os.File) error`: `syscall.Flock` exclusive non-blocking; `ErrBusy` on `EWOULDBLOCK`.
  - `func privateDir(path string) error`: today's `ensurePrivateDir` (mode 0700, owned by the current user).
  - `func checkPrivileges() error`: `refuseRoot(os.Geteuid())`.
  - `type proc struct{}` with `func newProc(cmd *exec.Cmd) (*proc, error)` (sets `Setpgid`), `func (p *proc) started(cmd *exec.Cmd) error` (no-op), `func (p *proc) stop(c *Cluster, immediate bool) error` (SIGINT, or SIGQUIT when `immediate`), `func (p *proc) close()` (no-op).
- `Cluster` gains the field `proc *proc`. `stopChild` calls `c.proc.stop(c, false)`, waits `stopWait`, then `c.proc.stop(c, true)`. `socketDir` calls `socketFallback` above `socketLimit`.

- [ ] **Step 1: Move the code** listed above without changing any behavior; `pgcluster.go` keeps `//go:build unix` in this task.
- [ ] **Step 2: Run** `go test ./internal/platform/pgcluster/ -v` and `make test-cluster`. Expected: PASS, the same 26 cluster tests as the F2 gate.
- [ ] **Step 3: Run** `make lint`. Expected: exit 0.
- [ ] **Step 4: Commit** `refactor(platform): gather the unix code of pgcluster in one file`.

---

### Task 4: Windows lock, private directory and socket path; CI job skeleton

**Files:**
- Create: `internal/platform/pgcluster/platform_windows.go`, `internal/platform/pgcluster/platform_windows_test.go`, `internal/platform/pgcluster/socket_windows_test.go`, `internal/platform/pgcluster/lock_test.go`
- Create: `packaging/windows/postgresql.env`, `scripts/windows-postgres.ps1`
- Modify: `internal/platform/pgcluster/pgcluster.go` (drop `//go:build unix`), `go.mod`, `go.sum`, `Makefile` (target `lint`), `.github/workflows/ci.yml`
- Delete: `internal/platform/pgcluster/pgcluster_other.go`; `ErrUnsupported` in `program.go`

**Interfaces:**
- Consumes: the function set of Task 3.
- Produces in `platform_windows.go`: `socketLimit = 107`; `socketFallback` returning `fmt.Errorf("socket path %s is over %d bytes; set EQUORI_DATA_DIR to a shorter directory", …)`; `lockFile` with `windows.LockFileEx(h, LOCKFILE_EXCLUSIVE_LOCK|LOCKFILE_FAIL_IMMEDIATELY, 0, 1, 0, &windows.Overlapped{})`, `ERROR_LOCK_VIOLATION` → `ErrBusy`; `privateDir(path)` that creates a missing directory with `windows.CreateDirectory` and the SDDL of the Global Constraints for SYSTEM and the token user, and checks an existing one against the accepted SIDs (spec W-M4) through `windows.GetNamedSecurityInfo` and the DACL's allow entries; `checkPrivileges` returning nil. `proc` methods are stubs returning `errors.New("not implemented")` until Task 5.
- Produces `func PrepareDataDir(dir string, accounts ...string) error` in `pgcluster.go`, backed by `prepareDataDir` in both platform files: Unix `os.MkdirAll(dir, 0o700)`; Windows creates the directory with SYSTEM, the token user and each named account (resolved with `windows.LookupSID`), or adds missing accounts to an existing directory as inheritable full-control entries. `lockDir` calls `prepareDataDir(dir)` instead of `os.MkdirAll`.
- `scripts/windows-postgres.ps1 -Out <dir>`: reads `packaging/windows/postgresql.env`, downloads `PG_URL`, fails on a SHA-256 other than `PG_SHA256`, extracts and prunes to W-P2 into `<dir>`, copies the three Visual C++ DLLs from the newest `VC\Redist\MSVC\*\x64\Microsoft.VC*.CRT` of the Visual Studio that `vswhere -latest -property installationPath` names, and fails when that folder is absent.

- [ ] **Step 1: Write the failing tests.**
  - `lock_test.go` (all platforms): `TestLockDirBusy`: `f, err := lockDir(dir)` succeeds; a second `lockDir(dir)` returns `ErrBusy`; after `f.Close()`, a third succeeds.
  - `platform_windows_test.go`: `TestPrivateDirCreates`: the DACL string of a new directory equals `D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;<token user SID>)`. `TestPrivateDirRefusesUsersGroup`: a directory created with `D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BU)` returns an error containing `S-1-5-32-545`. `TestPrivateDirAcceptsAccountSID`: a directory granting the token user and SYSTEM, with inherited entries, returns nil. `TestPrepareDataDirAddsAccounts`: `PrepareDataDir(dir, "NT AUTHORITY\\LOCAL SERVICE")` leaves an allow entry for `S-1-5-19`.
  - `socket_windows_test.go`: `TestSocketDirTooLong`: `socketDir(filepath.Join(t.TempDir(), strings.Repeat("a", 100)))` returns an error containing `EQUORI_DATA_DIR`; a short directory returns `<dir>\run`.
- [ ] **Step 2: Add the CI job** `windows` to `ci.yml`: `runs-on: windows-latest`, `defaults.run.shell: pwsh`, checkout, `setup-go` with `go-version-file: go.mod`, `scripts/windows-postgres.ps1 -Out $env:RUNNER_TEMP\pg` (cached by `actions/cache` keyed on `hashFiles('packaging/windows/postgresql.env')`), then `go test ./internal/platform/pgcluster/`.
- [ ] **Step 3: Add to `make lint`** a second run `GOOS=windows $(BIN)/golangci-lint run`, and `GOOS=windows CGO_ENABLED=0 go vet ./...`.
- [ ] **Step 4: Run locally** `go test ./internal/platform/pgcluster/ -run TestLockDirBusy -v` (PASS on Linux) and `make lint` (Expected: FAIL on `platform_windows.go` while it is absent, then exit 0 once Step 5 lands).
- [ ] **Step 5: Implement** `platform_windows.go` and `PrepareDataDir`; run `go mod tidy`; delete `pgcluster_other.go` and `ErrUnsupported`.
- [ ] **Step 6: Push** `f5-windows` and run `gh run watch` on the `ci` run. Expected: job `windows` PASS for the four Windows tests and `TestLockDirBusy`; job `check` PASS.
- [ ] **Step 7: Commit** `feat(platform): windows lock and private data directory for managed mode`.

---

### Task 5: Windows server process: restricted token, Job Object, stop (W-M6, W-M7, W-M8)

**Files:**
- Modify: `internal/platform/pgcluster/platform_windows.go`, `internal/platform/pgcluster/pgcluster_test.go`
- Create: `internal/platform/pgcluster/pgcluster_windows_test.go` (`//go:build cluster && windows`), `internal/platform/pgcluster/bundle_windows_test.go` (`//go:build cluster && windows`)
- Modify: `.github/workflows/ci.yml` (job `windows`)

**Interfaces:**
- Consumes: Task 4's `proc` stubs.
- Produces: `newProc(cmd)` creates the restricted token (Global Constraints), sets `cmd.SysProcAttr = &syscall.SysProcAttr{Token: syscall.Token(tok), CreationFlags: windows.CREATE_NEW_PROCESS_GROUP}` and creates a Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`; `started(cmd)` assigns the process to the job; `stop(c, false)` runs `pg_ctl stop -D <dir>\pg -m fast -w -t 60`; `stop(c, true)` runs `pg_ctl stop -D <dir>\pg -m immediate`, then `windows.TerminateJobObject`; `close()` closes the job and token handles. `CreateRestrictedToken` comes from `windows.NewLazySystemDLL("advapi32.dll")`, which `x/sys/windows` does not wrap.

- [ ] **Step 1: Make the stale-PID test portable.** `TestStartIgnoresAStalePidFile` starts `os.Args[0]` with `-test.run=TestHelperSleep` and `EQUORI_TEST_HELPER=sleep` instead of `sleep 120`; `TestHelperSleep` returns at once unless that variable is set, then sleeps 120 s.
- [ ] **Step 2: Write the failing Windows tests.**
  - `TestStartEndsTheServerWithItsParent`: a helper process (`EQUORI_TEST_HELPER=hold`, `TestHelperHold`) runs `Start` on a temporary directory and prints `pid <postmaster pid>`; the test kills the helper and asserts within 5 s that `windows.OpenProcess(SYNCHRONIZE, …)` plus `WaitForSingleObject(h, 0)` no longer reports the postmaster alive, then that `Start` on the same directory succeeds (spec S13, S14).
  - `TestBundleImportsResolve`: for every `.exe` and `.dll` under `EQUORI_TEST_POSTGRES_BIN` and `..\lib`, each name of `pe.File.ImportedLibraries()` exists in the bundle's `bin` or matches the Windows list of W-P3 (case-insensitive, `api-ms-win-crt-*` as a prefix).
- [ ] **Step 3: Extend the CI job** `windows`: `go test -tags cluster -count=1 ./internal/platform/pgcluster/` with `EQUORI_TEST_POSTGRES_BIN=$env:RUNNER_TEMP\pg\bin`.
- [ ] **Step 4: Push and watch.** Expected: FAIL with "not implemented" from the `proc` stubs.
- [ ] **Step 5: Implement** the `proc` methods.
- [ ] **Step 6: Push and watch.** Expected: every `cluster` test of `pgcluster` PASS on `windows-latest` (elevated runner, spec W-M7), and `make test-cluster` PASS locally.
- [ ] **Step 7: Commit** `feat(platform): run the managed server on windows`.

---

### Task 6: Windows test server, platform tests and cross-OS dumps (W-R1, W-R2)

**Files:**
- Modify: `.github/workflows/ci.yml`, `Makefile` (target `test-exchange`)
- Create: `internal/server/cluster_exchange_test.go` (`//go:build cluster`)
- Modify (only where a test fails on Windows for a platform reason): tests under `internal/platform/...` and `cmd/...`

**Interfaces:**
- Produces: `TestExchangeDump` writes `<EQUORI_TEST_DUMP_OUT>/<GOOS>.dump` and `<GOOS>.snapshot` (the `snapshot` helper of `cluster_backup_test.go`, one line per value) from the dataset of `TestClusterBackupRestoresAcrossForms`. `TestExchangeRestore` restores each `*.dump` of `EQUORI_TEST_DUMP_IN` into a managed cluster and into a `pgtest` database of `EQUORI_TEST_DATABASE_URL`, and requires the matching snapshot in both. Each calls `t.Fatal` when its variable is unset; their names stay outside the `^TestCluster` pattern of `make test-cluster`, so only the CI steps that set the variables run them.
- Produces: `make test-exchange EXCHANGE_IN=<dir>` runs the `cluster` test binary of `internal/server` with `-test.run '^TestExchangeRestore$'` inside `postgres:18` as `test-cluster` does, with `<dir>` mounted read-only at `/exchange` and `EQUORI_TEST_DUMP_IN=/exchange`.

- [ ] **Step 1: Write the two tests.**
- [ ] **Step 2: CI.** The `windows` job starts a test server from the bundle: `initdb -U equori --auth-host=scram-sha-256 --pwfile=<file holding "equori">`, `pg_ctl start -o "-p 54339 -c listen_addresses=127.0.0.1 -c max_connections=300"`. It sets `EQUORI_TEST_DATABASE_URL=postgres://equori:equori@127.0.0.1:54339/postgres?sslmode=disable` and runs `go test ./internal/platform/... ./cmd/...`, then `go test -tags cluster -count=1` of `internal/platform/backup`, `internal/server -run ^TestCluster` and `cmd/equori -run ^TestCluster`. The job `check` runs `TestExchangeDump` after `make check` and uploads `linux.dump` and `linux.snapshot`; the `windows` job downloads them, runs `TestExchangeRestore`, runs `TestExchangeDump` and uploads `windows.*`; a new job `exchange-linux` (`needs: windows`) downloads them and runs `make test-exchange`, which restores `windows.dump` into the compose test server and into a managed cluster.
- [ ] **Step 3: Push and watch.** Fix each Windows failure at its cause in the test or in platform code; a failure whose cause lies in a business module stops the task and is reported.
- [ ] **Step 4: Expected:** jobs `check`, `windows` and `exchange-linux` PASS.
- [ ] **Step 5: Commit** `test(platform): run the platform and cluster tests on windows`.

---

### Task 7: Windows service package and `equori service` (W-S1 to W-S5)

**Files:**
- Create: `internal/platform/winsvc/winsvc.go` (package comment, `ErrUnsupported`), `winsvc_windows.go`, `winsvc_other.go` (`//go:build !windows`), `log.go`, `log_test.go`
- Create: `cmd/equori/service.go`, `cmd/equori/service_test.go`
- Modify: `cmd/equori/main.go`

**Interfaces:**
- Produces (package `winsvc`):
  - `func IsService() bool` (`svc.IsWindowsService`; false elsewhere).
  - `func Run(name string, run func(ctx context.Context) error) error`: `svc.Run` with a handler accepting `AcceptStop | AcceptPreShutdown`; Stop and PreShutdown cancel `ctx`; the handler returns after `run` returns, with exit code 1 on an error so the recovery action restarts it.
  - `func Install(name, exe string, args []string, account string) error`: `mgr.Connect`, create or `UpdateConfig` (Global Constraints values), `SetRecoveryActions([{ServiceRestart, 5 * time.Second}], 86400)`.
  - `func Start(name string) error`, `func Stop(name string, wait time.Duration) error`, `func Uninstall(name string) error` (stop with 90 s wait, then `Delete`).
  - `func OpenLog(path string, limit int64) (*os.File, error)` (all platforms): renames a file over `limit` to `path + ".1"`, then opens for append, creating the directory.
  - `winsvc_other.go`: `IsService` false; the others return `ErrUnsupported`.
- Produces (package `main`): `serve(ctx context.Context) error` (the signal context moves to `main`); in service mode `main` calls `winsvc.Run("equori", serve)`. `setup()` in service mode replaces `os.Stdout` and `os.Stderr` with `winsvc.OpenLog(<data>\log\equori.log, 10 << 20)` before it creates the logger. `serviceCommand(args []string) error` with `install`, `stop`, `uninstall`: `install` runs `winsvc.Install("equori", exe, []string{"serve"}, `NT SERVICE\equori`)`, then `pgcluster.PrepareDataDir(dataDir, `NT SERVICE\equori`, <current user from os/user>)`, then `writeDefaultEnv(<data>\equori.env)`, then `winsvc.Start`. `func writeDefaultEnv(path string) error` writes `EQUORI_HTTP_ADDR=127.0.0.1:8080\n` only when the file is absent. On `winsvc.ErrUnsupported`, `serviceCommand` prints `equori service manages the Windows service; use brew services, a systemd unit or compose elsewhere` and exits 2.

- [ ] **Step 1: Write the failing tests.** `TestOpenLogRotates`: a file of 11 MiB with limit 10 MiB moves to `.1` and the opened file is empty; a file of 1 KiB stays and is appended to. `TestWriteDefaultEnv`: absent → exact content `EQUORI_HTTP_ADDR=127.0.0.1:8080\n`; present with `EQUORI_HTTP_ADDR=:9000\n` → unchanged. `TestServiceCommandElsewhere` (`service_unix_test.go`, `//go:build unix`): `serviceCommand([]string{"install"})` returns an error wrapping `winsvc.ErrUnsupported`.
- [ ] **Step 2: Run** `go test ./internal/platform/winsvc/ ./cmd/equori/ -run 'TestOpenLog|TestWriteDefaultEnv|TestServiceCommand' -v`. Expected: FAIL, undefined names.
- [ ] **Step 3: Implement** the package and the command; `main` adds `service` to the command switch and to the usage list.
- [ ] **Step 4: Run** the Step 2 command and `make lint`. Expected: PASS and exit 0.
- [ ] **Step 5: Push and watch.** Expected: job `windows` PASS (the service path itself runs in the smoke of Task 10).
- [ ] **Step 6: Commit** `feat(platform): run equori serve as a windows service`.

---

### Task 8: First user from the browser, API (W-U1 to W-U5, W-U7, W-U8)

**Files:**
- Modify: `api/openapi.yaml` (paths `/setup`, schemas `SetupStatus`, `SetupInput`), `db/queries/identity/identity.sql`, generated files through `make gen`
- Modify: `internal/identity/internal/adapter/postgres/repository.go`, `internal/identity/internal/app/service.go`, `internal/identity/internal/adapter/httpapi/server.go` and its problem mapping, `internal/identity/identity.go`, `internal/server/server.go`, `internal/server/tool_exposure_test.go`
- Create: `internal/identity/setup_test.go` (apitest), `internal/identity/internal/app/setup.go`
- Create: `cmd/equori/setup_url.go`, `cmd/equori/setup_url_test.go`; modify `cmd/equori/main.go`

**Interfaces:**
- OpenAPI, tag `identity`: `GET /setup` operationId `getSetup` → 200 `SetupStatus {required: boolean}`; `POST /setup` operationId `completeSetup`, body `SetupInput {token, email, password, language, region, base_currency?}` → 201 `User` with header `Set-Cookie`, 403, 409, 422 problems.
- sqlc: `-- name: LockUsers :exec` `LOCK TABLE identity_user IN EXCLUSIVE MODE;` and `-- name: AnyUser :one` `SELECT EXISTS (SELECT 1 FROM identity_user);`.
- Repository: `func (r *Repository) AnyUser(ctx context.Context) (bool, error)`; `func (r *Repository) CreateFirstUser(ctx context.Context, u domain.User, base money.Currency) (domain.User, error)` returning `app.ErrSetupComplete` when a user exists after the lock; the insert and the outbox event are shared with `CreateUser`.
- App (`setup.go`): `var ErrSetupTokenInvalid, ErrSetupComplete`; `type SetupHooks struct { DefaultCurrency func(region string) (money.Currency, bool); Done func() }`; `func (s *Service) UseSetupHooks(h SetupHooks)`; `func (s *Service) StartSetup(ctx context.Context) (string, error)` (empty string when a user exists); `func (s *Service) SetupRequired(ctx context.Context) (bool, error)`; `func (s *Service) CompleteSetup(ctx context.Context, token, email, password string, l locale.Locale, base money.Currency) (Session, domain.User, error)`: user exists → `ErrSetupComplete`; token differs (`subtle.ConstantTimeCompare`, empty stored token included) → `ErrSetupTokenInvalid`; empty `base` → `DefaultCurrency(region)`, absent → `&domain.FieldError{Field: "base_currency", …}`; then the validations of `CreateUser`, `CreateFirstUser` with role admin, the session of `Login`, the stored token cleared, `Done()`.
- Module: `func (m *Module) StartSetup(ctx context.Context) (string, error)`. `identity.Config` gains `DefaultCurrency func(region string) (money.Currency, bool)` and `SetupDone func()`; `identity.New` passes them to `svc.UseSetupHooks`. `server.Config` gains `SetupDone func()`; `server.New` fills `identity.Config` with `ledger.DefaultBaseCurrency` and `cfg.SetupDone`.
- `RequireSession` exempts `GET` and `POST` of `/api/v1/setup`.
- `cmd/equori`: `func setupURL(addr, token string) string`; in `serve`, after `server.New`: a non-empty token is logged at INFO as `first user setup` with `url`, and in managed mode written to `<data>/setup.url` with mode 0600; an empty token deletes a left `setup.url`. `server.Config.SetupDone` deletes `setup.url`.

- [ ] **Step 1: Write the failing tests** (`internal/identity/setup_test.go`, through `apitest.New` without a login):
  - `TestSetupRequiredUntilTheFirstUser`: `GET /api/v1/setup` → 200 `{"required":true}`; after a successful setup → `{"required":false}`.
  - `TestSetupCreatesTheAdmin`: token from `h.App.Identity.StartSetup`; POST with `language "en"`, `region "US"`, `base_currency "USD"` → status 201 checked before decoding; body role `admin`; the response cookie opens `GET /api/v1/me` with 200.
  - `TestSetupRejectsAnotherToken`: → 403, problem code `setup_token_invalid`.
  - `TestSetupClosesAfterTheFirstUser`: a second POST with the same token → 409 `setup_complete`; a user created with `h.App.Identity.CreateUser` before any POST also yields 409.
  - `TestSetupConcurrentRequests`: two goroutines POST valid bodies with different emails → exactly one 201 and one 409.
  - `TestSetupValidation`: region `"ZZ"` → 422 with a field error on `region`; a region without a default currency and no `base_currency` → 422 on `base_currency` (the region comes from `ledger`'s default table, read in the test, never a literal).
  - `TestSetupURL` (`cmd/equori`): `(":8080", "T")` → `http://127.0.0.1:8080/setup#token=T`; `("0.0.0.0:8080", "T")` → same; `("127.0.0.1:9000", "T")` → `http://127.0.0.1:9000/setup#token=T`; `("[::1]:8080", "T")` → `http://[::1]:8080/setup#token=T`.
  - `tool_exposure_test.go`: `"getSetup": "-session"`, `"completeSetup": "-session"`.
- [ ] **Step 2: Run** `make gen` then `go test ./internal/identity/... ./cmd/equori/ -run 'TestSetup' -v`. Expected: FAIL (handlers unimplemented, undefined functions).
- [ ] **Step 3: Implement** repository, app, handlers, problem mapping (403 `setup_token_invalid`, 409 `setup_complete`), the exemption, the module and server wiring, and the `serve` steps.
- [ ] **Step 4: Run** the Step 2 command, `go test ./internal/server/ -run TestToolExposure`, and `make test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(identity): create the first user from the browser with a setup token`, body naming W-U1 to W-U8 and the ADR 003 amendment of Task 12.

---

### Task 9: First user from the browser, web (W-U6)

**Files:**
- Create: `web/src/features/session/setup-page.tsx`, `setup-page.module.css`, `setup-page.test.tsx`
- Modify: `web/src/features/session/api.ts`, `web/src/features/session/index.ts`, `web/src/app/router.tsx`, `web/src/i18n/catalog.en.ts`, `web/src/i18n/catalog.pt-BR.ts`, `web/src/app/navigation-map.json` and its test exemption list (as `/offline` in F4)

**Interfaces:**
- Consumes: `getSetup`, `completeSetup` of the regenerated `web/src/api/schema.gen.ts`.
- Produces: `setupQuery` and `useCompleteSetup()` in `features/session/api.ts`; route `/setup` (page width `content`, as login); the `/login` route loader reads `setupQuery` and redirects to `/setup` when `required`; `/setup` redirects to `/login` when not required. Language choices come from `@/i18n/languages`, region choices from `@/i18n/regions` with `Intl.DisplayNames`, both through `@/ui/choice-select`. Catalog keys: `setup.title`, `setup.subtitle`, `setup.email`, `setup.password`, `setup.language`, `setup.region`, `setup.currency`, `setup.currency.help`, `setup.submit`, `setup.token_missing`, `problem.setup_token_invalid`, `problem.setup_complete`.

- [ ] **Step 1: Load the skills** `compose-screen` and `waiting-states`, and read `web/CLAUDE.md`.
- [ ] **Step 2: Write the failing tests** in `setup-page.test.tsx`: with `window.location.hash = "#token=abc"`, the page posts `token: "abc"` and `history.replaceState` leaves a URL without `#`; without a token it shows `setup.token_missing` and no submit button; the language field starts at the first catalog matching `navigator.languages`; the region field starts empty and submission without a region shows a field error; a 201 navigates to `/`; a 409 navigates to `/login`. In the router tests: `/login` with `{required: true}` lands on `/setup`.
- [ ] **Step 3: Run** `cd web && pnpm exec vitest run src/features/session/setup-page.test.tsx`. Expected: FAIL, module not found.
- [ ] **Step 4: Implement**, with every user-visible string from `useT()` (O6) and every new catalog key in both catalogs.
- [ ] **Step 5: Run** `make web-check` and the Step 3 command. Expected: exit 0 and PASS. The review-screen checks of the compose-screen skill pass; Slotted findings follow `web/CLAUDE.md`.
- [ ] **Step 6: Commit** only this task's hunks: `feat(web): first-user setup screen`.

---

### Task 10: Installer and Windows smoke test (W-I1 to W-I7, W-R3)

**Files:**
- Create: `packaging/windows/equori.iss`, `scripts/windows-smoke.ps1`
- Modify: `.github/workflows/ci.yml` (job `windows`)

**Interfaces:**
- `equori.iss` defines `#define AppVersion` from ISCC `/DAppVersion=X.Y.Z` and `#define Payload` (directory holding `equori.exe` and `postgresql\`). Sections: `[Setup]` (W-I2, `OutputBaseFilename=equori_{#AppVersion}_windows_amd64_setup`, `Compression=lzma2/ultra64`, `SolidCompression=yes`, `ArchitecturesAllowed=x64compatible`, `ArchitecturesInstallIn64BitMode=x64compatible`, `LanguageDetectionMethod=uilanguage`), `[Languages]` (`en` with `Default.isl`, `ptBR` with `Languages\BrazilianPortuguese.isl`), `[CustomMessages]` (the delete-data question in both), `[Files]`, `[INI]` (internet shortcut `{autoprograms}\equori.url`, `URL=http://127.0.0.1:8080/`), `[Run]` (`service install`, `runhidden waituntilterminated`; the postinstall `{code:SetupURL}` with `shellexec runasoriginaluser nowait postinstall skipifsilent`), `[UninstallRun]` (`service uninstall`, `RunOnceId: "service"`), `[Code]` (`PrepareToInstall` runs `{app}\equori.exe service stop` when `{app}\equori.exe` exists; `SetupURL` polls `http://127.0.0.1:8080/healthz` for up to 60 s through `WinHttp.WinHttpRequest` and returns the content of `{commonappdata}\equori\setup.url` when present; `CurUninstallStepChanged(usPostUninstall)` asks the delete-data question with `MB_DEFBUTTON2` when not `UninstallSilent` and runs `DelTree({commonappdata}\equori, True, True, True)` on Yes).
- `scripts/windows-smoke.ps1 -Installer <path> -Tag <vX.Y.Z or dev>`: the steps of W-R3 in order, each printing `<n> <what passed>`, plus "install over the running version" (run the installer a second time while the service runs; `/healthz` answers and the recorded transaction is present) and "port taken" (stop the service, listen on `127.0.0.1:8080` from PowerShell, start the service, require `bind` and `127.0.0.1:8080` in `%ProgramData%\equori\log\equori.log`, release the port, require `/healthz` within 30 s through the recovery action). It reads the token from `setup.url`, posts the setup with region and currency taken from parameters `-Region` and `-Currency` that CI passes, and checks that the `postgres.exe` processes of the killed `equori.exe` are gone with `Get-Process postgres` against the PIDs read before the kill.

- [ ] **Step 1: Write the smoke script** and add to the `windows` job: build `equori.exe` (`go build -trimpath -ldflags "-s -w -X main.version=dev"`) after `pnpm build` of `web/`, ISCC with `/DAppVersion=0.0.0 /DPayload=…`, then `scripts/windows-smoke.ps1 -Installer … -Tag dev -Region US -Currency USD`.
- [ ] **Step 2: Push and watch.** Expected: FAIL, `equori.iss` absent.
- [ ] **Step 3: Write `equori.iss`.**
- [ ] **Step 4: Push and watch.** Expected: every smoke step prints, job PASS; the job log holds the installer size.
- [ ] **Step 5: Commit** `build(platform): windows installer and its smoke test`.

---

### Task 11: Release job, currency check and signing (W-P4, W-P5, W-R4 to W-R7)

**Files:**
- Modify: `.github/workflows/release.yml`, `.github/workflows/ci.yml` (weekly `schedule` and job `postgres-current`)
- Create: `scripts/postgres-current.ps1`, `scripts/windows-upgrade-test.ps1`

**Interfaces:**
- `scripts/postgres-current.ps1 -Bin <dir> [-Versions <file or URL>]`: reads `latestMinor` of major `18` from `https://www.postgresql.org/versions.json` (or the given file), compares it with the minor of `<dir>\postgres.exe --version`, exits 1 with both values when the bundle is older. CI runs it once against a fixture with `latestMinor` one above the pin and requires exit 1, then against the live file.
- Release job `windows` (`needs: check`, `windows-latest`): bundle, `postgres-current.ps1`, web build, `equori.exe` with `-X main.version=<tag>`; when `secrets.AZURE_CLIENT_ID != ''`: `Azure/artifact-signing-action` over `equori.exe` and every `.exe` and `.dll` of the bundle, ISCC with `SignTool` bound to the same signer, `windows-smoke.ps1 -Tag <tag>`, `actions/attest-build-provenance`, `upload-artifact` named `windows`; otherwise the job prints `::notice::Windows installer not published: signing secrets are not set` after the smoke test and uploads nothing.
- Release job `release`: `needs: [dist, image, windows]`; downloads artifact `windows` when it exists (`continue-on-error` on the download only), appends `sha256sum` of the installer to `dist/SHA256SUMS`, and attaches the installer.
- `scripts/windows-upgrade-test.ps1 -Previous <installer> -New <installer> -PreviousRef <tag>`: W-R7, using `psql.exe` from the EDB zip of the pin over `C:\ProgramData\equori\run` and the snapshot SQL of `scripts/upgrade-test.sh`. The release job runs it when the previous tag's release holds a file matching `*_windows_amd64_setup.exe`.

- [ ] **Step 1: Write `postgres-current.ps1`** and its fixture step in `ci.yml`; push and watch. Expected: the fixture case exits 1, the live case exits 0 (18.6 is current per spec F8 on 2026-10-27).
- [ ] **Step 2: Add the weekly schedule** (`cron: "0 6 * * 1"`) running only the job `postgres-current`.
- [ ] **Step 3: Write the release changes and `windows-upgrade-test.ps1`.**
- [ ] **Step 4: Push and watch** the `ci` run of the branch. Expected: the workflows parse (a syntax error fails the run before any job) and `postgres-current` PASS.
- [ ] **Step 5: Owner:** after Task 0 Step 3 secrets exist, push a pre-release tag `vX.Y.Z-rc.N` on a commit of this branch merged to `main`; the release holds the signed installer and its `SHA256SUMS` line; `gh attestation verify <installer> --repo andrelopes-code/equori` passes; Windows "Properties → Digital Signatures" of the installer and of `C:\Program Files\equori\postgresql\bin\postgres.exe` name the signing identity.
- [ ] **Step 6: Commit** `ci: build, sign and publish the windows installer`.

---

### Task 12: Documents (W10)

**Files:**
- Create: `docs/adr/023-windows-form.md`
- Modify: `docs/adr/022-distribution.md`, `docs/adr/003-authentication.md`, `docs/adr/001-postgres-database.md`, `docs/domain/08-non-functional-requirements.md` (N24), `docs/domain/01-vision.md` (1.9), `docs/contributing/regions.md`, `README.md`, `docs/operations/backup.md`, `docs/operations/remote-access.md`, `docs/operations/release.md`

- [ ] **Step 1: ADR 023** with Context (spec F and S facts it relies on), Decision (W1 to W9 as one table per section), Consequences (a PATCH per PostgreSQL minor, W-P5; no unsigned Windows release; `golang.org/x/sys` direct), Revisit criteria of the spec.
- [ ] **Step 2: Dated amendments** of 2026-10-27: ADR 022 (D1 row, M1, M2, M3, M5, M6, M8, M9, R1 to R4, R7 citing the W rules), ADR 003 (W-U1 to W-U8 replace "No HTTP setup endpoint exists"), ADR 001 (bundled EDB build on Windows).
- [ ] **Step 3: README** section "Windows": download, the SmartScreen dialog if it appears, the setup screen, installing the web application from Edge, `equori.env` in `%ProgramData%\equori` for the port, `equori service stop` before `equori restore` (administrator terminal), uninstall and the data question. Every form: "the first start prints the setup URL" next to `equori user create`.
- [ ] **Step 4: backup.md** Windows paths and W-B1; **remote-access.md** `tailscale serve 8080` on Windows; **release.md** the signing secrets and W-P5; **regions.md** row "Installer languages: `packaging/windows/equori.iss`, `[Languages]` and `[CustomMessages]`, one per web catalog"; **N24** and **1.9** name the Windows installer.
- [ ] **Step 5: Run** `make check`. Expected: exit 0.
- [ ] **Step 6: Commit** `docs: record the windows form`, staging the files by name.

---

### Task 13: Acceptance on a clean Windows 11 (Owner)

- [ ] **Step 1 (Owner):** On a clean Windows 11 PC or VM with Smart App Control on and nothing else installed, download the installer of the pre-release of Task 11 Step 5 and run it. Expected: no Smart App Control block; one UAC prompt.
- [ ] **Step 2 (Owner):** The browser opens on the setup screen. Create the user, record a transaction, install the web application from Edge ("Apps → Install this site as an app").
- [ ] **Step 3 (Owner):** Restart the PC without logging on for 2 minutes, then open the installed application: the transaction is present.
- [ ] **Step 4 (Owner):** Wait for the periodic backup or run `equori backup` from a terminal; restore that file into a compose instance with `docs/operations/backup.md`; the transaction is present there.
- [ ] **Step 5 (Owner):** Uninstall from Settings → Apps and answer "No": `%ProgramData%\equori` remains. Reinstall: the data is back. Uninstall again and answer "Yes": the folder is gone.
- [ ] **Step 6 (Owner):** `gh repo delete andrelopes-code/equori-windows-spike` (the throwaway spike of the spec).
- [ ] **Step 7:** An agent records the results in `.superpowers/sdd/2026-10-27-distribution-f5-windows/progress.md`.
