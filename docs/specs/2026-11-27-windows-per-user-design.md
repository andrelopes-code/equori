# Distribution: the per-user Windows form

Status: draft, 2026-11-27. Supersedes `docs/specs/2026-10-27-distribution-windows-design.md` (the 2026-10-27 design) and ADR 023, except the rules this design keeps by ID.

## Intent

A person with Windows 10 or 11 installs equori in the way of a common program: download one file, double-click, Next, Finish. The browser opens on the first-user screen, and an icon in the notification area (tray) shows that equori runs. No Docker, no terminal, no administrator rights, no paid or third-party signature. Linux keeps the compose form of `scripts/install.sh` (ADR 022, D9).

## Decided by the owner

| ID | Decision |
|---|---|
| PU1 | No code signature and no dependency on a signing provider (Azure Artifact Signing, SignPath). |
| PU2 | The Windows form does not need Docker, WSL or a terminal. The person may hold administrator rights; the form does not require them. |
| PU3 | equori runs in the background with a tray icon; closing a window does not stop it. |
| PU4 | The dependency `fyne.io/systray` is accepted for the tray. |
| PU5 | The criterion is the least friction for a Windows user. On 2026-11-27 the owner delegated the choice of the delivery form to this design ("escolha o melhor"). |

## Context

| ID | Fact | Source |
|---|---|---|
| PF1 | A file downloaded by a browser carries the Mark of the Web; launching an unsigned program that carries it shows SmartScreen ("Windows protected your PC", "More info", "Run anyway"). | Microsoft, "Downloads and the Mark of the Web" |
| PF2 | Smart App Control, when on, blocks an unsigned program for which Microsoft's cloud service has no prediction. No per-program exception exists; the person can only turn Smart App Control off. | Microsoft Support, Smart App Control FAQ |
| PF3 | `fyne.io/systray` v1.12.2 (2026-06-09) builds with `GOOS=windows CGO_ENABLED=0`; `systray_windows.go` holds no cgo. Its module requirements are `golang.org/x/sys` and `github.com/godbus/dbus/v5` (Linux only). | Local build on 2026-11-27 |
| PF4 | The managed mode of `internal/platform/pgcluster` runs in the `standalone` image (`Dockerfile`, `EQUORI_DATA_DIR`, `EQUORI_POSTGRES_BIN`). Its Windows files (`platform_windows.go`, `process_windows.go`) and `scripts/windows-postgres.ps1` exist; no Windows release was published from them. | Repository at `688469696` |
| PF5 | The web holds backup creation (`web/src/features/setup/backup`). | Repository |

## Goals

| ID | Goal |
|---|---|
| PG1 | One file, `equori_X.Y.Z_windows_amd64_setup.exe`, installs equori for the current user on Windows 10 1803 or later and Windows 11, x64 and Arm through emulation. |
| PG2 | SmartScreen appears at most once, on the setup file. Installed files carry no Mark of the Web. |
| PG3 | Running a newer setup file upgrades the program and keeps every fact. |
| PG4 | Every file of the form, data included, lives under one folder chosen in the setup. |

## Non-goals

Code signature; Windows service; machine-wide installation; winget, Scoop and Microsoft Store; a portable zip; native ARM64; a desktop window wrapper.

## Anti-goals

The design fails, even when every artifact builds, when any of these holds:

- The setup asks for administrator rights.
- A step of the installation or of daily use requires a terminal.
- Microsoft Defender reports a file of the setup or of the installed folder as a threat.
- An upgrade or an uninstall deletes data without the person choosing it.

## Approaches

| Approach | Steps for the person | Result |
|---|---|---|
| Per-user setup (Inno Setup, no elevation) | download, double-click, Next, Finish | adopted: one SmartScreen screen, Start menu entry, uninstall in Settings → Apps, upgrade by running the new setup |
| Portable zip | download, "Extract all", open the folder, double-click | rejected: a program run from inside the zip runs in a temporary folder and loses its data; no Start menu entry, no uninstall entry |
| PowerShell command (`irm … \| iex`) | open PowerShell, paste, Enter | rejected: a terminal is outside the habits of the target person (PU2) |

## Decisions

### PW1 Artifacts

| ID | Rule |
|---|---|
| PW1.1 | The release attaches `equori_X.Y.Z_windows_amd64_setup.exe` and appends its line to `SHA256SUMS`. No signing step and no condition on secrets: W-R5, W-R6 and `scripts/windows-sign.ps1` are removed. |
| PW1.2 | The setup installs `equori.exe`, linked with `-H windowsgui`, which runs the tray and the server; `equori-cli.exe`, the same `cmd/equori` linked as a console program, for terminal commands (`backup`, `restore`, `version`, `stop`); `postgresql\`, the bundle of W-P1 to W-P4, kept unchanged; `LICENSE`. |
| PW1.3 | Both executables carry a version resource (product name, version, description). No executable is packed (no UPX). |

### PW2 Setup

| ID | Rule |
|---|---|
| PW2.1 | `packaging/windows/equori.iss` is rewritten: `PrivilegesRequired=lowest`, default folder `{localappdata}\equori`, the folder page shown, `MinVersion=10.0.17134`, x64 compatible, languages `en` and `ptBR`. |
| PW2.2 | Task "Start with Windows", checked by default: a shortcut to `equori.exe --background` in the user's Startup folder. |
| PW2.3 | A Start menu entry "equori" points to `equori.exe`. |
| PW2.4 | The finish page starts `equori.exe` (checked by default). A silent installation starts nothing. |
| PW2.5 | Upgrade: before replacing files, the setup runs the installed `equori-cli.exe stop`. `serve` takes the pre-migration backup of B3 before it migrates. |
| PW2.6 | Uninstall runs `equori-cli.exe stop`, removes the program files and the Startup shortcut, and asks whether to delete `data\` and `backups\`, with "No" as default. A silent uninstall keeps them. |

### PW3 Tray and execution

| ID | Rule |
|---|---|
| PW3.1 | `equori.exe` without arguments: when an instance of the same folder holds `equori.lock` (W-M6), it opens the browser at the configured address and exits. Otherwise it starts `serve` in the same process and shows the tray icon. |
| PW3.2 | After `/healthz` answers, the browser opens at the content of `setup.url` when the file exists (W5 of the 2026-10-27 design), else at the configured address. `--background` opens nothing. |
| PW3.3 | Tray menu: "Open equori" (also the action of a click on the icon), "Start with Windows" (check item that creates or removes the shortcut of PW2.2), a separator, "Quit". The tooltip names the address. |
| PW3.4 | "Quit" and `equori-cli.exe stop` stop PostgreSQL through `pg_ctl stop` and end the process. `stop` waits up to 90 s for the lock of PW3.1 to be released. |
| PW3.5 | A start failure (port in use, refused data directory, PostgreSQL error) shows a Windows message box with the error and the path of the log, then exits. |
| PW3.6 | The standard output and error of `equori` and of `postgres.exe` go to `<data>\log\equori.log`, rotated at 10 MiB to `equori.log.1` (the rule of W-S4, moved out of `internal/platform/winsvc`). |
| PW3.7 | The tray and message box texts exist in `en` and `pt-BR`; the language is the Windows user interface language when it is Portuguese, else `en`. |
| PW3.8 | The tray code sits in a Windows-only file of `cmd/equori`; on Linux and macOS `equori` has no tray and no `stop` behavior change. `fyne.io/systray` is imported only from that file. |

### PW4 Data and configuration

| ID | Rule |
|---|---|
| PW4.1 | On Windows, the default data directory is `data\` beside the executable, and backups go to `backups\` beside it. W-M1 (`%ProgramData%\equori`) is removed. |
| PW4.2 | W-M2 to W-M9 of ADR 023 hold unchanged: bundled programs, protected DACL created with a missing data directory, socket without a TCP port, restricted token, Job Object. |
| PW4.3 | The setup writes `equori.env` with `EQUORI_HTTP_ADDR=127.0.0.1:8080` when the file is absent; an upgrade never rewrites it. |

### PW5 Removed

`equori service` and `internal/platform/winsvc` (after PW3.6 moves the log rotation), `scripts/windows-sign.ps1`, the signing secrets of `docs/operations/release.md`, and the installer flow of `scripts/windows-smoke.ps1` and `scripts/windows-upgrade-test.ps1`, which PW6 replaces. `scripts/install.ps1` (compose on Windows) stays; `docs/install/windows.md` leads with the setup and keeps compose as the section for Docker users.

### PW6 CI and release

| ID | Rule |
|---|---|
| PW6.1 | The release job `windows` builds the bundle, runs `scripts/postgres-current.ps1`, builds both executables, compiles the setup, runs PW6.2 and uploads the setup. |
| PW6.2 | `scripts/windows-smoke.ps1 SETUP TAG`: silent per-user install (`/VERYSILENT /CURRENTUSER`); no installed file has a `Zone.Identifier` stream; `equori.exe --background` starts; `/healthz` answers; `equori-cli.exe version` reports the tag; `POST /api/v1/setup` with the token of `setup.url` returns 201; an account and a transaction are recorded; `equori-cli.exe backup` writes a file in `backups\`; `equori-cli.exe stop` ends every `equori.exe` and `postgres.exe` of the folder; a second start keeps the transaction; Microsoft Defender scans the folder and the setup (`MpCmdRun.exe -Scan -ScanType 3 -File`) with no threat; silent uninstall removes the program and keeps `data\PG_VERSION`. |
| PW6.3 | From the second release that holds the setup, `scripts/windows-upgrade-test.ps1` installs the previous setup, seeds it with `cmd/demoseed`, installs the new setup over it and requires the snapshot of `upgrade-test.sh`. |
| PW6.4 | The CI job `windows` builds the setup without uploading it and runs PW6.2 on a pull request that changes `cmd/equori`, `internal/platform/pgcluster`, `packaging/windows` or the scripts of PW6. |

### PW7 Documents

| Document | Change |
|---|---|
| ADR 040 (new) | The per-user Windows form and the dependency `fyne.io/systray`; supersedes ADR 023 except W-P1 to W-P5 and W-M2 to W-M9. |
| ADR 023 | Status: superseded by ADR 040. |
| `docs/specs/2026-10-27-distribution-windows-design.md` | Status line: superseded by this design. |
| `docs/install/windows.md`, `windows.pt-BR.md` | Download, SmartScreen step ("More info", "Run anyway"), the Smart App Control limit of PF2, the tray, upgrade, uninstall. |
| `docs/operations/release.md` | Signing secrets removed. |

## Known limits

| Limit | Effect | Stated in |
|---|---|---|
| PF2 | With Smart App Control on, Windows blocks `equori.exe`; the person can only turn Smart App Control off. | `docs/install/windows.md` |
| Logoff and shutdown | Whether `fyne.io/systray` passes the end-of-session message is not measured. Without it, Windows ends the process, the Job Object ends `postgres.exe`, and the next start runs WAL recovery; with `fsync` on, no committed transaction is lost. | ADR 040 |

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: no regional value. The language of PW3.7 follows the Windows interface language. |
| R2 | A language other than Portuguese gets `en` (PW3.7). |
| R3 | Does not apply: no value set. |
| R4 | Does not apply: no extension point. |
| R5 | The tray and message box texts of PW3.3 to PW3.5 in `en` and `pt-BR`, in a Go table beside the tray code (the web catalog is not loaded before the server starts); the setup texts from Inno's `en` and `ptBR` message files and `[CustomMessages]`. |
| R6 | Does not apply: no screen writes a number or a date. |
| C1 to C4 | Does not apply: no amount. |
| T1, T2 | Does not apply: no date. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | "Start with Windows" is the presence of a shortcut in the Startup folder, not a stored setting. The address is a host value in `equori.env` (PW4.3). |
| D1 to D4 | Does not apply: no table, schema or fact changes. |
| D5 | Does not apply: no field of the diagnostic file. |
| S1 | Does not apply: no operation in `api/openapi.yaml`. |
| S2 | Does not apply: no screen. |
| S3 | Does not apply: no screen changes; the guide of installation is `docs/install/windows.md` (PW7). |
| S4 | Does not apply. |
| X1 | Does not apply: no scenario of `docs/domain/06-scenarios.md`; PW6.2 is the acceptance test. |
| X2 | Does not apply. |

## Verification

| Rule | Test |
|---|---|
| PW1, PW2, PW3.1 to PW3.4, PW4 | PW6.2 on `windows-latest` |
| PW3.6 | the rotation test moved with the log code |
| PW3.7 | a table test of the language choice |
| PW3.8 | `go vet` and `golangci-lint` with `GOOS=windows` and on Linux |
| PW6.3 | from the second release |

## Calls left to the builder

- The signal between `equori-cli.exe stop` and the running instance (named event, local endpoint or lock wait), within PW3.4.
- The icon file of the tray and of the setup, from the existing mark.
- Whether `scripts/windows-postgres.ps1` passes PW6.2 unchanged; a failure is fixed inside it.

## Sources

- Downloads and the Mark of the Web: https://textslashplain.com/2016/04/04/downloads-and-the-mark-of-the-web/
- Smart App Control FAQ: https://support.microsoft.com/windows/smart-app-control-faq-285ea03d-fa88-4d56-882e-6698afdb7003
- fyne-io/systray: https://github.com/fyne-io/systray
