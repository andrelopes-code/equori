# Distribution: the Windows form

Status: draft, 2026-10-27. Amends `docs/specs/2026-10-26-distribution-design.md` (the original design below), which stays as written. Each original rule this design changes is cited by its ID next to the new rule.

## Intent

A person with Windows 10 or 11, without Docker, WSL or a terminal, installs equori from one installer and uses it in the browser and as an installed web application. The installer, the service and the first-user screen give the ease of a common program. The executable, the code and the database engine are those of the other forms.

## Decided by the owner

| ID | Decision |
|---|---|
| WO1 | A person with Windows 10 or 11, without Docker, WSL or a terminal, installs and uses equori. Administrator rights are asked only by the installer. |
| WO2 | One executable and one code base serve every form (G2). The platform difference sits behind per-file build tags; business code and `cmd/equori` hold no `runtime.GOOS` branch. |
| WO3 | The Windows form runs PostgreSQL 18 (G1). |
| WO4 | Security on Windows equals or exceeds the Unix forms: no PostgreSQL port reachable from the network, no `trust` over TCP. |
| WO5 | Uninstalling removes the program and the service and keeps the data, unless the person chooses to delete it. |
| WO6 | The language and region of the first user come from the setup screen, never from the installer. |
| WO7 | No artifact contacts a host the owner did not configure (anti-goal of the original design). |
| WO8 | On 2026-10-27 the owner delegated the six open decisions of the session brief (bundling, signing, browser setup, execution form, channels, architectures) to this design ("siga"). They are design calls, listed in "Design calls for review". |

## Context

Measured on 2026-10-27 at commit `f318da9`. The spike ran three times on GitHub's `windows-latest` (Windows Server 2025 Datacenter, build 26100) in the private repository `andrelopes-code/equori-windows-spike`: runs 40428516978, 40428889398, 40429228044. The spike source is throwaway and outside this repository.

### PostgreSQL for Windows

| ID | Fact | Source |
|---|---|---|
| F1 | EDB publishes `postgresql-18.6-5-windows-x64-binaries.zip` (384,620,317 bytes, SHA-256 `e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2`, Last-Modified 2026-10-05). It holds `postgres`, `initdb`, `pg_ctl`, `pg_dump`, `pg_restore`, `pg_upgrade`, `pg_isready` and `psql` (`.exe`) and `lib/btree_gist.dll`. | EDB binaries page; central directory of the zip |
| F2 | The executables and DLLs of the zip carry no Authenticode signature (security directory of the PE is empty for `postgres.exe`, `pg_dump.exe`, `btree_gist.dll`, `libcrypto-3-x64.dll`, `libintl-9.dll`). | PE headers |
| F3 | The six programs and the server modules import 14 DLLs of `bin/` (`icudt77`, `icuin77`, `icuuc77`, `libcrypto-3-x64`, `libiconv-2`, `libintl-9`, `liblz4`, `libpq`, `libssl-3-x64`, `libwinpthread-1`, `libxml2`, `libxslt`, `libzstd`, `zlib1`) and `vcruntime140.dll`, `vcruntime140_1.dll`, `msvcp140.dll`, which the zip does not hold. `plperl.dll`, `plpython3.dll` and `pltcl.dll` import `perl542.dll`, `python313.dll` and `tcl86t.dll`, which the zip does not hold either. | Import tables of the PE files |
| F4 | Microsoft permits local deployment of the Visual C++ runtime DLLs in the application's folder. | MS Learn, "Deployment in Visual C++", "Determining which DLLs to redistribute" |
| F5 | The bundle of W-P2 measures 70 MB in 1,012 files and 17.9 MB with `xz -9e`. `share/locale` (message translations of the server) measures 23.6 MB and is outside it. | Local measurement of the zip |
| F6 | Licenses: PostgreSQL License for the server; third-party texts (OpenSSL 3, ICU, zstd, lz4, libxml2, gettext, libiconv, winpthreads under LGPL 2.1) in `commandlinetools_3rd_party_licenses.txt`. | Zip contents |
| F7 | Days between each PostgreSQL 18 minor and its first EDB build in winget: 18.1 +2, 18.2 +3, 18.3 +2, 18.4 +7, 18.6 0. 18.5 has no winget build. | postgresql.org release notes; commit dates in `microsoft/winget-pkgs` |
| F8 | `https://www.postgresql.org/versions.json` lists `latestMinor` per major (major 18: `6`, `relDate` 2026-08-13). | postgresql.org |
| F9 | The winget package `PostgreSQL.PostgreSQL.18` (18.6-5) is the EDB installer, `Scope: machine`, which registers a server service on port 5432 with a superuser password. | winget manifest; EDB installer parameters |
| F10 | EDB publishes no Windows ARM64 zip. Windows 11 on Arm runs x64 applications through emulation. | EDB binaries page; MS Learn, "How emulation works on Arm" |
| F11 | PostgreSQL runs on Unix-domain sockets on Windows since 13. Its `main.c` refuses a token with administrator rights. `pg_ctl` starts the server with a restricted token. | PostgreSQL 13.0 release notes; `REL_18_STABLE/src/backend/main/main.c` |

### Spike measurements

| ID | Measurement | Result |
|---|---|---|
| S1 | Directory created with SDDL `D:P(A;OICI;FA;;;<user>)(A;OICI;FA;;;SY)` | `pg/`, `run/` and the socket file inherit exactly those two entries |
| S2 | `os.Stat(dir).Mode().Perm()` on Windows | `0777`: Go reports no Unix mode on Windows |
| S3 | `LockFileEx` exclusive, fail-immediately, held by another process | `ERROR_LOCK_VIOLATION`; free again after that process is killed |
| S4 | `initdb --locale-provider=builtin --builtin-locale=C.UTF-8` | 2.6 to 2.8 s; database reports provider `b`, locale `C.UTF-8` |
| S5 | `postgres.exe` under the full token of an elevated administrator | exits: "Execution of PostgreSQL by a user with administrative permissions is not permitted" |
| S6 | `postgres.exe` under a restricted token without adding the user to the token's default DACL | exits: `could not execute command "postgres.exe -V": Permission denied` |
| S7 | `postgres.exe` under a restricted token (Administrators and Power Users disabled, `DISABLE_MAX_PRIVILEGE`, user added to the default DACL) | ready in 0.32 s, elevated and as a service |
| S8 | pgx v5.11.0 over the socket `C:\...\run` | connects; `CREATE EXTENSION btree_gist`, `uuidv7()` and an exclusion constraint succeed |
| S9 | `listen_addresses` with `-c listen_addresses=` | empty; `netstat -ano` lists no TCP socket of the postmaster |
| S10 | Another local account connects to the socket | refused: "An attempt was made to access a socket in a way forbidden by its access permissions"; accepted after a grant on the socket file |
| S11 | `pg_dump -Fc` over the socket, `pg_restore --list` | succeed; the dump inherits the DACL of its folder |
| S12 | `pg_ctl stop -m fast -w` | 0.14 to 0.88 s, `postmaster.pid` removed |
| S13 | Parent of `postgres.exe` killed, child in a Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` | postmaster gone within 5 s; `postmaster.pid` left |
| S14 | Start over the left `postmaster.pid` | ready in 0.48 s; the row committed before the kill is present |
| S15 | Service `equorispike` under `NT SERVICE\equorispike`, SID type unrestricted, registered with `golang.org/x/sys/windows/svc/mgr` | starts at install; recovery "restart after 5000 ms, reset 86400 s"; the installing account connects to its socket |
| S16 | Service stop and restart | fast shutdown in 0.14 s; `Restart-Service` 1.5 s; `postmaster.pid` absent after stop |
| S17 | Inno Setup on the runner | preinstalled at `C:\Program Files (x86)\Inno Setup 6\ISCC.exe`; compile 28 s; installer 25,842,936 bytes with the bundle and a 15 MB executable |
| S18 | Silent install, silent uninstall | 28.4 s and 2.3 s; after uninstall the service and `C:\Program Files\equorispike` are gone, `C:\ProgramData\equorispike\data\pg\PG_VERSION` is present |
| S19 | `equori.exe` built for windows/amd64 at `f318da9` | 34.2 MB, 9.2 MB with `xz -9e` |

### Signing, runners, installer tool

| ID | Fact | Source |
|---|---|---|
| F12 | Smart App Control is on by default on clean installs of Windows 11 22H2 and later. When Microsoft's cloud service cannot predict an application's safety, an application without a valid signature is blocked. No per-application exception exists. | Microsoft Support, Smart App Control FAQ |
| F13 | Since 2024, EV certificates go through the same SmartScreen reputation as OV certificates. | MS Learn, "Code signing options" |
| F14 | Azure Artifact Signing (formerly Trusted Signing): US$ 9.99 per month for 5,000 signatures. Individuals in the USA and Canada; organizations in the USA, Canada, the EU and the UK. Signing integrates with GitHub Actions (`Azure/artifact-signing-action`). | MS Learn, "Code signing options"; GitHub |
| F15 | SignPath Foundation signs open-source projects at no cost and forbids signing binaries built outside the project's repository. | signpath.org/terms |
| F16 | Standard GitHub-hosted runners are free in public repositories. The Windows 2-core x64 runner costs US$ 0.010 per minute elsewhere. `andrelopes-code/equori` is public. | GitHub Docs, billing and runner pricing |
| F17 | The Inno Setup license permits any use, including commercial. | jrsoftware.org/files/is/license.txt |
| F18 | On Windows, AF_UNIX `connect` requires write permission on the socket file. | Microsoft, "AF_UNIX comes to Windows" |

## Goals

| ID | Goal |
|---|---|
| WG1 | One signed installer puts equori on Windows 10 (1803 or later) and Windows 11, x64 and Arm (through emulation). |
| WG2 | After the installer finishes, the browser opens on the first-user screen. |
| WG3 | equori runs from boot without a logon, and a restart of the computer keeps every fact. |
| WG4 | Backup and restore follow B1 to B7 of the original design. A dump of the Windows form restores into compose, standalone and Homebrew, and the reverse. |
| WG5 | A new installer upgrades equori and the PostgreSQL minor in place, after the pre-migration backup of B3. |
| WG6 | The release tests the Windows form before it publishes it. |

## Non-goals

| Non-goal | Reference |
|---|---|
| Native Windows ARM64 build | F10, Revisit criteria |
| winget manifest, Microsoft Store | Revisit criteria |
| Tray icon, desktop window wrapper | the installed web application gives the window (A3 of the original design) |
| Installation without administrator rights | WA3 |
| Upgrade of the PostgreSQL major | V6 of the original design |
| A Windows archive for external mode | W1 |

## Anti-goals

The design fails, even when every artifact builds, when any of these holds:

- A Windows installer is published without a valid signature on the installer and on every PE file it installs.
- A release ships a PostgreSQL minor older than `latestMinor` of `versions.json` (F8).
- PostgreSQL opens a TCP port, or the HTTP server listens beyond `127.0.0.1` without an explicit setting.
- The data directory grants access to a group SID (Everyone, Users, Authenticated Users).
- An uninstall deletes data without an explicit choice.
- A `postgres.exe` outlives the `equori.exe` that started it.
- The setup endpoint creates a user after the first one exists, or accepts a request without the token.

## Analysis

### WA1 PostgreSQL source on Windows

| Source | No terminal, no extra server | Current minor | Programs |
|---|---|---|---|
| EDB zip, bundled | yes | F7: 0 to 7 days | complete (F1) |
| winget `PostgreSQL.PostgreSQL.18` | no: a terminal command, an administrator scope and a second server on port 5432 (F9) | F7 | complete |
| theseus-rs, zonky | yes | behind or incomplete (A4 of the original design) | incomplete (zonky) |

The revisit criterion of the original design for a bundled PostgreSQL (a source within 14 days of each minor, over two consecutive minors) holds for Windows x64 (F7).

Decision: the installer bundles the EDB zip, pinned by version and SHA-256. A4 of the original design changes for Windows only (W-P1).

### WA2 Signing

| Option | Result on a clean Windows 11 with Smart App Control on |
|---|---|
| Unsigned | blocked when the cloud service has no prediction (F12); fails WO1 |
| SignPath Foundation | signs `equori.exe` and the installer; may not sign the EDB files (F15), which stay unsigned (F2) |
| EV certificate | no SmartScreen advantage over OV (F13) |
| Azure Artifact Signing | signs every PE file the installer holds; integrates with GitHub Actions (F14) |

Decision: Azure Artifact Signing signs the installer, the uninstaller and every PE file of the payload, the EDB files included. Without signing credentials the release publishes no Windows installer (W-R6). Eligibility (F14) is an owner step.

### WA3 Execution form

| | Windows service | Per-user program at logon |
|---|---|---|
| Starts | at boot, without a logon | at the logon of that user |
| Stop at shutdown | Stop and PreShutdown requests of the service manager (S16) | the end of the session |
| Restart after a crash | recovery actions of the service manager (S15), the equivalent of M6 "the service manager restarts it" | none |
| Window | none | a console window, unless a second GUI-subsystem build exists |
| Administrator | the installer | none |

Decision: a service named `equori` under the virtual account `NT SERVICE\equori`. The data directory is `%ProgramData%\equori`, shared by the service and the terminal commands of the account that installed it.

### WA4 Database access path

A Unix-domain socket on Windows keeps M5: no port, and access control by the DACL of the directory (S9, S10, F18). TCP on `127.0.0.1` with `scram-sha-256` exposes a port to every local process and needs a password file.

Decision: the socket of M5 on every platform.

### WA5 First user

| Option | Result |
|---|---|
| CLI only (ADR 003) | fails WO1 |
| Endpoint open to loopback requests | `tailscale serve` and reverse proxies of D8 reach equori from loopback, so a remote request passes |
| Endpoint gated by a one-time token readable only on the host | no race: a request without the token fails; closed once a user exists |

Decision: the token of W-U1 in every form.

### WA6 Installer tool

Inno Setup was measured (S17, S18) and is preinstalled on the runner. WiX and NSIS were not measured.

Decision: Inno Setup 6.

### WA7 Channels and architectures

The installer is a release asset. A winget manifest needs a pull request to `microsoft/winget-pkgs` per release and is deferred. x64 only (F10).

## Decisions

### W1 Form

D1 of the original design gains one row; the row "Windows archive or installer" of A3 changes from "deferred" to "adopted: installer".

| Form | Artifact | Targets | PostgreSQL | Data | Default listen address |
|---|---|---|---|---|---|
| Windows | `equori_X.Y.Z_windows_amd64_setup.exe` | Windows 10 1803 or later, Windows 11; x64, and Arm through emulation | managed, bundled EDB build (W-P1) | `%ProgramData%\equori` | `127.0.0.1:8080` |

### W2 PostgreSQL on Windows (amends A4)

| ID | Rule |
|---|---|
| W-P1 | `packaging/windows/postgresql.env` pins `PG_VERSION`, `PG_URL` and `PG_SHA256` of the EDB zip. The build downloads the zip and refuses a SHA-256 that differs. No program downloads PostgreSQL at run time. |
| W-P2 | The bundle holds: in `bin/`, the six programs `postgres`, `initdb`, `pg_ctl`, `pg_dump`, `pg_restore`, `pg_upgrade`, the 14 DLLs of F3, and `vcruntime140.dll`, `vcruntime140_1.dll`, `msvcp140.dll` from the `Microsoft.VC14*.CRT` redistributable folder of the runner's Visual Studio; in `lib/`, every DLL except `plperl.dll`, `plpython3.dll`, `pltcl.dll`; `share/` without `locale/`; `server_license.txt` and `commandlinetools_3rd_party_licenses.txt`. `scripts/windows-postgres.ps1` builds it, for CI and for the release. |
| W-P3 | Every DLL imported by a PE file of the bundle resolves to a file of the bundle or to a DLL that Windows ships (`api-ms-win-crt-*`, `kernel32`, `advapi32`, `ws2_32`, `secur32`, `wldap32`, `crypt32`, `bcrypt`, `ole32`, `oleaut32`, `shell32`, `user32`, `iphlpapi`, `pdh`, `ntdll`, `dbghelp`, `netmsg`, `msvcrt`). A test with `debug/pe` checks it. |
| W-P4 | `scripts/postgres-current.ps1` compares the minor of `PG_VERSION` in `packaging/windows/postgresql.env`, which W-P1 binds to the bundle by its SHA-256, with `latestMinor` of its major in `versions.json` (F8), and fails when the pin is older. The release job runs it; the workflow `postgres.yml` runs it weekly and on a pull request that changes the pin. |
| W-P5 | The owner tags a PATCH release within 14 days of each PostgreSQL 18 minor that EDB has published. |

### W3 Managed mode on Windows

| ID | Rule |
|---|---|
| W-M1 | Amends M1. The default data directory on Windows is `%ProgramData%\equori`, from the environment variable `ProgramData`. |
| W-M2 | Amends M2. Programs come from `EQUORI_POSTGRES_BIN`; without it, from `postgresql/bin` in the directory of the running executable when that directory holds `postgres`; without it, from the directory of `postgres` on `PATH`. A directory holds `postgres` when `exec.LookPath(filepath.Join(dir, "postgres"))` succeeds, which accepts `postgres.exe` on Windows. |
| W-M3 | Amends M3. On Windows, the modes 0700 and 0600 are replaced by the DACL of the data directory: protected, every entry inheritable to files and directories, full control for SYSTEM and for the accounts of W-M4 or W-S2. Everything under it inherits those entries (S1). |
| W-M4 | Amends M3 and the check of the socket directory. On Windows, a missing data directory is created with the DACL of W-M3 for SYSTEM and the account of the process. An existing data directory or socket directory is accepted when every allow entry of its DACL, inherit-only entries included, names SYSTEM (`S-1-5-18`), Administrators (`S-1-5-32-544`), CREATOR OWNER (`S-1-3-0`), a service SID (`S-1-5-80-…`) or an account SID (`S-1-5-21-…`). Any other SID, or a missing DACL, stops the start with a message naming the SID. |
| W-M5 | Amends M5. The server runs with `listen_addresses = ''` and the socket in `run/` on every platform (S8, S9). On Windows the limit of the socket path is 107 bytes; a longer path stops the start with a message naming `EQUORI_DATA_DIR`, without the temporary-directory fallback of the Unix platforms. |
| W-M6 | Amends M6. On Windows, the lock is `LockFileEx` with `LOCKFILE_EXCLUSIVE_LOCK` and `LOCKFILE_FAIL_IMMEDIATELY` on byte 0 of `equori.lock`; `ERROR_LOCK_VIOLATION` is `ErrBusy` (S3). `postgres.exe` starts under a restricted token: `CreateRestrictedToken` with `DISABLE_MAX_PRIVILEGE`, Administrators and Power Users (`S-1-5-32-547`) disabled, and the process account added to the token's default DACL, as `pg_ctl` does (S6, S7). It starts with `CREATE_NEW_PROCESS_GROUP`, so a Ctrl-C in a terminal reaches `equori` only, and joins a Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, so it ends with `equori` (S13). The fast shutdown is `pg_ctl stop -D pg -m fast -w -t 60` (S12); after 60 s, `pg_ctl stop -m immediate`, then termination of the Job Object. |
| W-M7 | Amends M8. On Windows, managed mode does not refuse an elevated token; the restricted token of W-M6 removes the administrator rights from `postgres.exe` (S5, S7). |
| W-M8 | Replaces M9. Managed mode runs on Linux, macOS and Windows. `pgcluster.ErrUnsupported` is removed. |
| W-M9 | Code shape. `internal/platform/pgcluster` holds `platform_unix.go` (`//go:build unix`) and `platform_windows.go` with the same unexported functions: lock, private directory check, socket path limit and fallback, process attributes and post-start hook, fast and immediate stop, privilege check. `pgcluster.go` loses its build tag; `pgcluster_other.go` and `owner_unix.go` are removed. `backup`, `config` (whose `DefaultDataDir` keeps its `goos` parameter) and `cmd/equori` hold no platform branch. |

### W4 Windows service

| ID | Rule |
|---|---|
| W-S1 | `equori serve` started by the service manager runs under `svc.Run` of `golang.org/x/sys/windows/svc`. Stop and PreShutdown cancel the context of `serve`, the path of SIGTERM in M6. Package `internal/platform/winsvc` holds the Windows code; its other-platform file returns "not a service". |
| W-S2 | `equori service install`, run by the installer with administrator rights: creates or updates service `equori` (binary `<executable> serve`, account `NT SERVICE\equori`, SID type unrestricted, automatic start, recovery: restart after 5 s, reset after 1 day); creates `%ProgramData%\equori` with the DACL of W-M3 for SYSTEM, the service SID and the account that runs the command, or adds the two accounts to an existing directory; writes `equori.env` with `EQUORI_HTTP_ADDR=127.0.0.1:8080` when the file is absent; starts the service. A second run updates the configuration and changes no data. |
| W-S3 | `equori service stop` stops the service and waits up to 90 s for the stopped state. `equori service uninstall` stops and deletes the service and leaves the data directory. |
| W-S4 | In service mode, the standard output and error of `equori` and of `postgres.exe` go to `<data>\log\equori.log`. At each start of the service, a file over 10 MiB moves to `equori.log.1`, which it replaces. |
| W-S5 | On Linux and macOS, `equori service` exits with status 2 and a message naming `brew services`, systemd units and compose. |

### W5 First user from the browser (amends ADR 003; every form)

| ID | Rule |
|---|---|
| W-U1 | When no user exists, `serve` generates a setup token: 32 bytes of `crypto/rand` in base64url, held in memory. It logs once at INFO the message `first user setup` with the URL `http://<host>:<port>/setup#token=<token>`, where the host is `127.0.0.1` when the listen address has no host. In managed mode it also writes that URL to `<data>/setup.url`, under the data directory's protection (mode 0600 on Unix, W-M3 on Windows). |
| W-U2 | `GET /api/v1/setup`, without a session, returns 200 with `{"required": true}` while no user exists and `{"required": false}` afterwards. |
| W-U3 | `POST /api/v1/setup`, without a session, takes `token`, `email`, `password`, `language`, `region` and the optional `base_currency`. It creates an `admin` with the rules of `CreateUser`, sets the session cookie and returns 201 with the profile. A token that differs (`crypto/subtle.ConstantTimeCompare`) returns 403 `setup_token_invalid`. An existing user returns 409 `setup_complete`. Invalid fields return 422 `validation_failed`. Without `base_currency`, the default of the region applies (`ledger.DefaultBaseCurrency`); a region without a default returns 422 on `base_currency`. |
| W-U4 | The creation runs in one transaction that takes `LOCK TABLE identity_user IN EXCLUSIVE MODE`, checks that no user exists and inserts. Of two concurrent valid requests, one returns 201 and the other 409. |
| W-U5 | After a successful setup, the token is discarded and `setup.url` is deleted. At start, `serve` deletes a `setup.url` left while a user exists. |
| W-U6 | The web application asks `GET /api/v1/setup` on the login route and moves to `/setup` when it is required. `/setup` reads the token from the URL fragment and removes the fragment from the address bar. The form asks email, password, language (default: the first catalog matching `navigator.languages`), region (no default) and base currency (optional). |
| W-U7 | `equori user create` keeps working in every form. |
| W-U8 | `RequireSession` exempts login and both setup operations. The setup operations are not exposed as language-model tools (`tool_exposure_test.go`). |

### W6 Installer

| ID | Rule |
|---|---|
| W-I1 | `packaging/windows/equori.iss` (Inno Setup 6) builds `equori_X.Y.Z_windows_amd64_setup.exe` on `windows-latest` with the preinstalled ISCC (S17), compression `lzma2/ultra64`, solid. |
| W-I2 | Administrator rights, install directory `{autopf}\equori`, `MinVersion=10.0.17134`, x64 compatible. Files: `equori.exe`, the bundle of W-P2 under `postgresql\`, `LICENSE`, `README.md`. |
| W-I3 | After the files, the installer runs `equori.exe service install` hidden and waits for it. Its last page opens, as the account that started the installer, the content of `setup.url`, or `http://127.0.0.1:8080/` when the file is absent, after `/healthz` answers or 60 s pass. A silent installation opens nothing. |
| W-I4 | The Start menu holds the internet shortcut `equori` to `http://127.0.0.1:8080/`. |
| W-I5 | An installation over an existing one runs the installed `equori.exe service stop` before it replaces files, then W-I3. `serve` takes the pre-migration backup of B3 before it migrates. |
| W-I6 | The uninstaller runs `equori.exe service uninstall`, then removes the files. An interactive uninstall asks whether to delete `%ProgramData%\equori`, backups included, with "No" as default; "Yes" deletes it. A silent uninstall keeps it. |
| W-I7 | The installer's languages are those of the web catalogs (English, Brazilian Portuguese), chosen by the Windows display language. They set no language or region of a user (WO6). |

### W7 CI and release

| ID | Rule |
|---|---|
| W-R1 | Amends R1. `make check` runs `go vet` and `golangci-lint` a second time with `GOOS=windows`. `ci.yml` gains the job `windows` (`windows-latest`): it builds the bundle (W-P2), runs `go test ./internal/platform/... ./cmd/...` against a test server started from the bundle on `127.0.0.1:54339` with `scram-sha-256` (the business modules hold no platform code), runs the `cluster` tests of `pgcluster`, `backup`, `server` (`^TestCluster`) and `cmd/equori` (`^TestCluster`) with `EQUORI_TEST_POSTGRES_BIN`, builds an unsigned installer and runs the smoke test of W-R3. |
| W-R2 | B4 across operating systems: the Linux job writes a dump of a seeded database and its N12 snapshot as a workflow artifact; the `windows` job restores it in managed mode and compares; it writes its own dump, which a later Linux job restores into a compose database and compares. |
| W-R3 | Amends R4. `scripts/windows-smoke.ps1 INSTALLER TAG`: silent install; `/healthz` answers; `equori version` reports the tag; `POST /api/v1/setup` with the token of `setup.url` returns 201; an account and a transaction are recorded through the API; `equori backup` from the installing account writes a file in `backups\`; `Restart-Service equori` keeps the transaction; killing `equori.exe` leads to a restart by the service manager and no `postgres.exe` of the killed process remains; silent uninstall removes the service and the program and keeps `%ProgramData%\equori\pg\PG_VERSION`. |
| W-R4 | Amends R2 and R3. The release job `windows` needs `check`, builds the bundle, runs W-P4, signs (W-R5), compiles the installer, runs W-R3, attests the installer and uploads it. The job `release` attaches it and appends its line to `SHA256SUMS`. |
| W-R5 | Signing: `scripts/windows-sign.ps1` runs `signtool` with the dlib of `Microsoft.ArtifactSigning.Client` (pinned by version and SHA-256) against Azure Artifact Signing. It signs `equori.exe` and every `.exe` and `.dll` of the bundle before compilation, and Inno Setup's `SignTool` calls it for the installer and the uninstaller, which Inno signs during compilation. Secrets: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `ARTIFACT_SIGNING_ENDPOINT`, `ARTIFACT_SIGNING_ACCOUNT`, `ARTIFACT_SIGNING_PROFILE`. |
| W-R6 | Without the signing secrets, the release job `windows` builds and tests, uploads nothing to the release, and writes a notice; the rest of the release proceeds. |
| W-R7 | Amends R7. From the second tag whose release holds a Windows installer, `scripts/windows-upgrade-test.ps1 PREV_INSTALLER NEW_INSTALLER PREV_REF` installs the previous installer, populates it with `cmd/demoseed` over HTTP, takes the snapshot of `upgrade-test.sh` through `psql` of the EDB zip over the socket, installs the new installer over it and requires the same snapshot. |

### W8 Configuration and backup on Windows

| ID | Rule |
|---|---|
| W-C1 | C2 and C3 apply on Windows: `equori.env` and `secret.key` sit in `%ProgramData%\equori` under the DACL of W-M3. |
| W-B1 | B1 to B7 apply unchanged. `backups\` inherits the data directory's DACL; a dump written with `--out` elsewhere inherits the ACL of its folder (S11), which `docs/operations/backup.md` states. |

### W9 Dependency

`golang.org/x/sys` becomes a direct dependency for `windows` and `windows/svc`. It is in `go.sum` today as an indirect dependency (v0.49.0, through `golang.org/x/term`), so the module graph gains no module. ADR 023 records it (CLAUDE.md, "A new dependency needs an ADR").

### W10 Documents changed with this design

| Document | Change |
|---|---|
| ADR 023 (new) | The Windows form: W1 to W9. |
| ADR 022 | Dated amendment: D1 gains the Windows row; M1, M2, M3, M5, M6, M8 and M9 cite W-M1 to W-M8; R1 to R4 and R7 cite W-R1 to W-R7. |
| ADR 003 | Dated amendment: W-U1 to W-U8 replace "No HTTP setup endpoint exists". |
| ADR 001 | Dated amendment: on Windows the managed mode runs the bundled EDB build (W-P1). |
| `docs/domain/08-non-functional-requirements.md` | N24 lists the Windows installer. |
| `docs/domain/01-vision.md` 1.9 | The constraint names the Windows form. |
| `docs/contributing/regions.md` | New row: installer languages in `packaging/windows/equori.iss`, one per web catalog (W-I7). |
| `README.md` | Section "Windows". The first user from the browser in every form. |
| `docs/operations/backup.md` | Windows paths, W-B1. |
| `docs/operations/remote-access.md` | `tailscale serve` on Windows in front of `127.0.0.1:8080`. |
| `docs/operations/release.md` | Signing secrets, W-P5. |

## Verification

| Rule | Test |
|---|---|
| W-M2 | `TestBinExplicit`, `TestBinBesideExecutable`, `TestBinFromPath` on Linux; on Windows, `TestBinExplicit` against a directory holding `postgres.exe`. |
| W-M3, W-M4 | `TestPrivateDirCreates`, `TestPrivateDirRefusesUsersGroup`, `TestPrivateDirAcceptsAccountSID`, `TestPrepareDataDirAddsAccounts`. |
| W-M5 | `TestSocketDirTooLong` on Windows: a path over 107 bytes returns the error naming `EQUORI_DATA_DIR`. |
| W-M6 | `TestLockDirBusy` on both platforms; the `cluster` tests of `pgcluster` on the `windows` job, plus `TestStartEndsTheServerWithItsParent` (a helper process holding the cluster is killed; the postmaster's process ends within 5 s). `TestStartIgnoresAStalePidFile` holds the stale PID with a helper process instead of `sleep`. |
| W-M7 | The `windows` job runs elevated: every `cluster` test exercises the restricted token. |
| W-P3 | `TestBundleImportsResolve` (`cluster` tag, Windows) over `EQUORI_TEST_POSTGRES_BIN/..`. |
| W-P4 | The currency step fails on a `versions.json` fixture with a newer minor (script self-test in the job). |
| W-S1 to W-S5 | W-R3 smoke; `TestOpenLogRotates` for W-S4; `TestWriteDefaultEnv` for W-S2; `TestServiceCommandElsewhere` for W-S5. |
| W-U1 to W-U8 | `internal/apitest` tests: required true then false; 403 `setup_token_invalid`; 201 with cookie and admin role; 409 `setup_complete`; two concurrent requests give one 201 and one 409; 422 for an invalid region and for a region without a default currency; `setup.url` written and deleted (managed-mode test). Web tests of the setup route: the token read from the fragment, the fragment removed, the redirect from login. |
| W-I3 to W-I6 | W-R3 smoke; the interactive data-deletion prompt is an owner step. |
| W-R2 | `TestExchangeDump` and `TestExchangeRestore` in the jobs `check`, `windows` and `exchange-linux`. |
| W-R7 | From the second tag with a Windows installer. |
| WG1, WG2, WG3 | Owner step on a clean Windows 11 PC with Smart App Control on: install, setup screen, a transaction, an installed web application from Edge, a restart, a backup restored into compose, an uninstall that keeps the data. |

## Phases

| Phase | Content | Depends on |
|---|---|---|
| F5 Windows | W2 to W9, W10 | F2; F3 for the documents it amends |

## Design calls for review

| Call | Rule |
|---|---|
| Bundle the EDB zip | WA1, W-P1 |
| Azure Artifact Signing; no unsigned Windows release | WA2, W-R5, W-R6 |
| Browser setup with a one-time token, in every form | WA5, W5 |
| Windows service under `NT SERVICE\equori`, data in `%ProgramData%\equori` | WA3, W4 |
| Release asset only; no winget | WA7 |
| x64 only | WA7 |
| Unix socket on Windows instead of TCP with `scram-sha-256` | WA4, W-M5 |
| `share/locale` left out of the bundle: server messages in English | W-P2 |
| HTTP on `127.0.0.1:8080` through `equori.env` | W-S2 |

## Revisit criteria

| Deferred item | Revisit when |
|---|---|
| Native Windows ARM64 | EDB publishes a Windows ARM64 binaries zip. |
| winget manifest | Two consecutive signed Windows releases are published. |
| Another signing provider | The owner is not eligible for Azure Artifact Signing (F14). |
| Per-user installation without administrator rights | A person reports a computer where the installer's elevation is not available. |
| Server messages in the person's language | A person reports a PostgreSQL message shown in the interface. |

## Sources

- EDB binaries: https://www.enterprisedb.com/download-postgresql-binaries
- PostgreSQL versions: https://www.postgresql.org/support/versioning/, https://www.postgresql.org/versions.json
- PostgreSQL 13.0 release notes: https://www.postgresql.org/docs/release/13.0/
- PostgreSQL `main.c`: https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/main/main.c
- winget manifests: https://github.com/microsoft/winget-pkgs/tree/master/manifests/p/PostgreSQL/PostgreSQL/18
- EDB installer parameters: https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/command_line_parameters/
- Visual C++ deployment: https://learn.microsoft.com/en-us/cpp/windows/deployment-in-visual-cpp
- AF_UNIX on Windows: https://devblogs.microsoft.com/commandline/af_unix-comes-to-windows/
- Smart App Control: https://support.microsoft.com/en-us/topic/what-is-smart-app-control-285ea03d-fa88-4d56-882e-6698afdb7003
- Code signing options: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- Azure Artifact Signing action: https://github.com/Azure/artifact-signing-action
- SignPath Foundation conditions: https://signpath.org/terms
- GitHub Actions billing and pricing: https://docs.github.com/en/actions/concepts/billing-and-usage, https://docs.github.com/en/billing/reference/actions-runner-pricing
- Inno Setup license: https://jrsoftware.org/files/is/license.txt
- Emulation on Arm: https://learn.microsoft.com/en-us/windows/arm/apps-on-arm-x86-emulation
