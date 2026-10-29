# ADR 023: The Windows form

- Status: accepted
- Date: 2026-10-27
- Design: `docs/specs/2026-10-27-distribution-windows-design.md`
- Amends: ADR 022 (D1, M1, M2, M3, M5, M6, M8, M9, R1 to R4, R7), ADR 003 (first admin), ADR 001 (PostgreSQL source on Windows)

## Context

A person with Windows 10 or 11, without Docker, WSL or a terminal, installs and uses equori. The EDB binaries zip of PostgreSQL 18.6 holds every program managed mode runs, `btree_gist` included, and no Authenticode signature; its build followed each 18.x minor within 0 to 7 days. On Windows, PostgreSQL 13 and later listens on a Unix-domain socket, and connecting to one requires write permission on the socket file. `postgres.exe` refuses a token with administrator rights. Smart App Control blocks an unsigned program on a clean Windows 11 when Microsoft's cloud service has no prediction about it. A spike on `windows-latest` measured each primitive below (design, S1 to S19).

## Decision

### Installer and PostgreSQL

| ID | Rule |
|---|---|
| W1 | The form is `equori_X.Y.Z_windows_amd64_setup.exe` (Inno Setup 6), x64, for Windows 10 1803 or later and Windows 11; Arm runs it through emulation. |
| W-P1 | `packaging/windows/postgresql.env` pins the EDB zip by version, URL and SHA-256; no program downloads PostgreSQL at run time. |
| W-P2 | `scripts/windows-postgres.ps1` builds the bundle: six programs, their 14 DLLs, the Visual C++ runtime from Visual Studio's redistributable folder, `lib/` without the procedural languages, `share/` without `locale/`, the license files. |
| W-P4, W-P5 | `scripts/postgres-current.ps1` fails a pin older than the current minor of `versions.json`; the release runs it and `postgres.yml` runs it weekly. The owner tags a PATCH release within 14 days of each PostgreSQL 18 minor. |
| W-I1 to W-I7 | `packaging/windows/equori.iss`: administrator rights once, `{autopf}\equori`, `equori.exe service install` after the files, the setup screen opened at the end, `service stop` before an upgrade, `service uninstall` before removal, data kept unless an interactive uninstall is answered Yes. Its languages are the web catalogs'. |

### Managed mode on Windows

| ID | Rule |
|---|---|
| W-M1 | The default data directory is `%ProgramData%\equori`. |
| W-M2 | Programs come from `EQUORI_POSTGRES_BIN`, else `postgresql/bin` beside the executable, else `PATH`; `exec.LookPath` accepts `postgres.exe`. |
| W-M3, W-M4 | The data directory carries a protected DACL for SYSTEM and the accounts it serves; everything under it inherits it. A directory granting any SID other than SYSTEM, Administrators, CREATOR OWNER, a service SID or an account SID is refused. |
| W-M5 | The socket of M5 is kept: no TCP port; a socket path over 107 bytes stops the start. |
| W-M6, W-M7 | `LockFileEx` locks `equori.lock`. `postgres.exe` runs under a restricted token without the Administrators and Power Users groups, in its own process group and in a Job Object that kills it with `equori`; `pg_ctl stop` stops it. |
| W-M8, W-M9 | Managed mode runs on Linux, macOS and Windows; the platform code of `pgcluster` sits in `platform_unix.go` and `platform_windows.go`. |

### Service

| ID | Rule |
|---|---|
| W-S1 to W-S5 | Service `equori` under `NT SERVICE\equori`, automatic start, restart 5 s after any failure (crash or exit code); Stop and PreShutdown cancel `serve`; `equori service install|stop|uninstall`; the log is `log\equori.log`, rotated at 10 MiB. |

### Release

| ID | Rule |
|---|---|
| W-R1 to W-R3 | `make lint` lints and vets for `GOOS=windows`; the ci job `windows` runs the platform, cluster and exchange tests and smoke-tests the installer. |
| W-R4 to W-R7 | The release job `windows` signs every PE file with Azure Artifact Signing through `signtool` and its dlib (`scripts/windows-sign.ps1`), smoke-tests, attests and publishes the installer only when signed, and runs the upgrade test from the second tag with an installer. |

### Dependency

`golang.org/x/sys` becomes a direct dependency for `windows`, `windows/svc` and `windows/svc/mgr`. It was already in `go.sum` through `golang.org/x/term`.

## Consequences

- Each PostgreSQL 18 minor brings an equori PATCH release within 14 days.
- No Windows installer is published unsigned; until the owner's signing account exists, the release builds and tests the installer and attaches nothing.
- The web serves its files with a fixed content type per extension: on Windows, Go's `mime` reads the registry.

## Revisit criteria

The design's: native ARM64 when EDB publishes it; winget after two signed releases; another signing provider when the owner is not eligible for Azure Artifact Signing; a per-user installation when the installer's elevation is unavailable.
