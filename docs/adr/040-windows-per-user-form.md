# ADR 040: The per-user Windows form

- Status: accepted
- Date: 2026-11-27
- Design: `docs/specs/2026-11-27-windows-per-user-design.md`
- Supersedes: ADR 023
- Amends: ADR 022 (D9, for Windows)

## Context

ADR 023 shipped Windows as an Inno Setup installer that registers a Windows service. The installer is an unsigned program, and a browser marks it with the Mark of the Web (PF1). SmartScreen then shows "Windows protected your PC" before the first run, and Smart App Control blocks it outright when the cloud service has no prediction about it (PF2). The owner rejected code signing and a signing provider (PU1) and asked for the least friction on Windows (PU5).

`fyne.io/systray` v1.12.2 builds with `GOOS=windows CGO_ENABLED=0`; `systray_windows.go` holds no cgo, and `godbus/dbus` is required by its Linux files only (PF3). The same file handles `WM_ENDSESSION` by calling the exit callback, so a logoff reaches the tray's exit code (A4 of the plan).

The managed mode of `internal/platform/pgcluster` already runs in the `standalone` image and holds the Windows files for the process and the socket (PF4). `scripts/install.ps1` installed compose under `%USERPROFILE%\equori` (PF5).

## Decision

- The form is a per-user program: `irm .../install.ps1 | iex` downloads the release zip, checks its SHA-256 and extracts it into `%LOCALAPPDATA%\equori`. A file written by PowerShell carries no Mark of the Web, so SmartScreen does not run (PW2). No administrator rights are needed.
- The release attaches `equori_X.Y.Z_windows_amd64.zip` and `install.ps1`. The zip holds `equori.exe` (linked with `-H windowsgui`, default command `tray`) and `equori-cli.exe` (console) (PW1).
- `equori.exe` runs `serve` in the process of a tray icon. The tray offers Open, Start with Windows (the `equori` value under `HKCU\...\Run`) and Quit. A second process on the same folder opens the browser and exits, decided by `pgcluster.Held` (PW3.1 to PW3.5).
- `equori-cli.exe stop` signals the named event `Local\equori-stop-<16 hex>` of the data directory, which the tray waits on, and waits for the lock to be released (PW3.4).
- The output of the process goes to `<data>\log\equori.log`, rotated at 10 MiB by `internal/platform/logfile` (PW3.6).
- Data lives in `data\` beside the executable; an unset `EQUORI_HTTP_ADDR` is `127.0.0.1:8080` on Windows (PW4).
- Rules W-P1 to W-P5 and W-M2 to W-M9 of ADR 023 hold. W-M1 (`%ProgramData%\equori`) is replaced by PW4.1.
- ADR 022 D9 installs compose with `scripts/install.ps1` on Windows. The script now installs this form; the compose flow remains a manual section of `docs/install/windows.md` (PW7).
- The Windows service, `equori service`, `internal/platform/winsvc`, the Inno Setup script and the signing steps are removed (PW5).

## Dependency

- `fyne.io/systray` v1.12.2 is the tray. Only `cmd/equori/tray_windows.go` and `cmd/equori/tray_menu_windows.go` import it; `go list -deps ./cmd/equori` on Linux lists no package of it.
- `github.com/tc-hib/go-winres` v0.3.3 is a build tool for the version resource and icon of both executables (Task 4 of the plan). No Go package imports it.

## Consequences

- With Smart App Control on, Windows blocks `equori.exe`. The person can only turn Smart App Control off; `docs/install/windows.md` states it (PF2).
- No service exists. equori runs while the user is logged on, and starts at logon through the Run value.
- At logoff or shutdown the tray's exit callback cancels `serve` and waits up to 20 seconds, so PostgreSQL stops cleanly. A session that ends sooner leaves the Job Object to end `postgres.exe`; the next start runs WAL recovery, and with `fsync` on no committed transaction is lost.
- No installer program and no signature exist to maintain.
- The tray exists on Windows only. Linux and macOS builds return an error for the `tray` command.
