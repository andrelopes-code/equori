# Distribution: the per-user Windows form

Status: draft, 2026-11-27. Supersedes `docs/specs/2026-10-27-distribution-windows-design.md` (the 2026-10-27 design) and ADR 023, except the rules this design keeps by ID.

## Intent

A person with Windows 10 or 11, without WSL, processor virtualization, a virtual machine or Docker, installs equori with one pasted PowerShell command, the counterpart of `scripts/install.sh` on Linux. The command shows no SmartScreen screen. After it, the browser opens on the first-user screen, and an icon in the notification area (tray) shows that equori runs. No Docker, no WSL, no administrator rights, no paid or third-party signature. Linux keeps the compose form of `scripts/install.sh` (ADR 022, D9).

## Decided by the owner

| ID | Decision |
|---|---|
| PU1 | No code signature and no dependency on a signing provider (Azure Artifact Signing, SignPath). |
| PU2 | The Windows form does not need Docker or WSL. The person may hold administrator rights; the form does not require them. Basic terminal use is acceptable. |
| PU3 | equori runs in the background with a tray icon; closing a window does not stop it. |
| PU4 | The dependency `fyne.io/systray` is accepted for the tray. |
| PU5 | The criterion is the least friction for a Windows user and the same ease of installation on Windows and Linux. On 2026-11-27 the owner delegated the choice of the delivery form to this design ("escolha o melhor"). |

## Context

| ID | Fact | Source |
|---|---|---|
| PF1 | A file downloaded by a browser carries the Mark of the Web (an NTFS stream `Zone.Identifier`); launching an unsigned program that carries it shows SmartScreen ("Windows protected your PC", "More info", "Run anyway"). `Unblock-File` removes the stream. | Microsoft, "Downloads and the Mark of the Web"; PowerShell `Unblock-File` reference |
| PF2 | Smart App Control, when on, blocks an unsigned program for which Microsoft's cloud service has no prediction. No per-program exception exists; the person can only turn Smart App Control off. | Microsoft Support, Smart App Control FAQ |
| PF3 | `fyne.io/systray` v1.12.2 (2026-06-09) builds with `GOOS=windows CGO_ENABLED=0`; `systray_windows.go` holds no cgo. Its module requirements are `golang.org/x/sys` and `github.com/godbus/dbus/v5` (Linux only). | Local build on 2026-11-27 |
| PF4 | The managed mode of `internal/platform/pgcluster` runs in the `standalone` image (`Dockerfile`, `EQUORI_DATA_DIR`, `EQUORI_POSTGRES_BIN`). Its Windows files (`platform_windows.go`, `process_windows.go`) and `scripts/windows-postgres.ps1` exist; no Windows release was published from them. | Repository at `688469696` |
| PF5 | `scripts/install.ps1` (327 lines) installs compose under `%USERPROFILE%\equori`, with numbered steps and texts in `en` and `pt-BR`. | Repository |

## Goals

| ID | Goal |
|---|---|
| PG1 | One command, `irm https://github.com/andrelopes-code/equori/releases/latest/download/install.ps1 \| iex`, installs equori for the current user on Windows 10 1803 or later and Windows 11, x64 and Arm through emulation. |
| PG2 | No SmartScreen screen at installation or at use: no installed file carries a `Zone.Identifier` stream. |
| PG3 | Running the same command again upgrades the program and keeps every fact. |
| PG4 | Every file of the form, data included, lives under one folder. |
| PG5 | No prerequisite: no WSL, no processor virtualization, no virtual machine, no Docker, no separate PostgreSQL. equori and the bundled `postgres.exe` run as native Windows programs. |
| PG6 | The script states each step, its result and its duration, and every failure names its cause, the action that fixes it and the section of `docs/install/windows.md` that covers it. |

## Non-goals

Code signature; Windows service; machine-wide installation; a graphical setup program; winget, Scoop and Microsoft Store; native ARM64; a desktop window wrapper; compose on Windows through a script.

## Anti-goals

The design fails, even when every artifact builds, when any of these holds:

- The installation asks for administrator rights.
- The installation or the use requires enabling WSL, virtualization, a virtual machine or Docker.
- The script asks a question during an installation or an upgrade.
- SmartScreen or Microsoft Defender shows a warning for a file of the form.
- An upgrade or an uninstall deletes data without the person choosing it.

## Approaches

| Approach | Steps for the person | Result |
|---|---|---|
| PowerShell command | open PowerShell, paste, Enter | adopted: no SmartScreen screen (PF1, `Unblock-File`), the same pattern as `install.sh` on Linux, upgrade by the same command |
| Per-user setup program (Inno Setup, no elevation) | download, double-click, Next, Finish | rejected: SmartScreen on the setup file, an anti-goal; a second tool (Inno) in the release |
| Portable zip | download, "Extract all", open the folder, double-click | rejected: SmartScreen on the extracted program; a program run from inside the zip runs in a temporary folder and loses its data |

## Decisions

### PW1 Artifacts

| ID | Rule |
|---|---|
| PW1.1 | The release attaches `equori_X.Y.Z_windows_amd64.zip` and `install.ps1`, and appends the line of the zip to `SHA256SUMS`. No signing step and no condition on secrets: W-R5, W-R6 and `scripts/windows-sign.ps1` are removed. |
| PW1.2 | The zip holds `equori.exe`, linked with `-H windowsgui`, which runs the tray and the server; `equori-cli.exe`, the same `cmd/equori` linked as a console program, for terminal commands (`backup`, `restore`, `version`, `stop`, `uninstall`); `postgresql\`, the bundle of W-P1 to W-P4, unchanged; `LICENSE`. |
| PW1.3 | Both executables carry a version resource (product name, version, description). No executable is packed (no UPX). |

### PW2 Installation script

| ID | Rule |
|---|---|
| PW2.1 | `scripts/install.ps1` installs the form of this design and no longer runs compose. It keeps the step display and the `en` and `pt-BR` texts of PF5, and runs on Windows PowerShell 5.1. |
| PW2.2 | Folder: `%LOCALAPPDATA%\equori`, or the value of `EQUORI_DIR` when set before the command. |
| PW2.3 | Steps: download the zip of the release; check its SHA-256 against `SHA256SUMS`; stop a running instance with the installed `equori-cli.exe stop`; extract the program files over the folder, never touching `data\`, `backups\` and `equori.env`; run `Unblock-File` on every extracted file; write `equori.env` with `EQUORI_HTTP_ADDR=127.0.0.1:8080` when absent. |
| PW2.4 | The script creates the Start menu shortcut "equori" to `equori.exe`, the Startup folder shortcut to `equori.exe --background` (the "Start with Windows" item of PW3.3, on by default), and the entry "equori" under `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall`, whose command is `equori-cli.exe uninstall`. |
| PW2.5 | The script ends by starting `equori.exe`, which opens the browser (PW3.2), and prints the address. |
| PW2.6 | `equori-cli.exe uninstall` stops the instance, removes the program files, both shortcuts and the registry entry, and asks whether to delete `data\` and `backups\`, with "No" as default. `--yes` answers yes; `--keep-data` answers no without asking. |
| PW2.7 | An upgrade keeps the state of "Start with Windows": the script recreates the Startup shortcut only when it existed before or on a first installation. |

### PW2b Script presentation and order

| ID | Rule |
|---|---|
| PW2.8 | The first line names the version and the operation: installation into the folder, upgrade from the installed version, or "already at version X", which ends the script in under 2 s without a download. |
| PW2.9 | Each step is one line: a mark at column 3 (`[..]` while it runs, `[ok]` green, `[!!]` red), the step name, its detail and its duration, aligned on fixed columns, at most 80 columns, never wrapped. The running line is rewritten in place with the elapsed seconds; the download line also shows megabytes received, the total and the percentage. |
| PW2.10 | Steps, in order: checks (Windows 10 1803 or later, x64 or Arm, write access to the folder, port of `EQUORI_HTTP_ADDR` free, Smart App Control not in the "On" state); download; SHA-256 check; stop of the running instance; files; shortcuts; start and `/healthz`. The download and its check finish before the running instance stops, so an upgrade keeps equori unavailable only during the files, shortcuts and start steps. |
| PW2.11 | The download reads the response as a stream and writes its own progress (Windows PowerShell 5.1 slows a download with its own progress bar on). A network failure is retried 3 times, 2 s apart. |
| PW2.12 | A failure ends the step with `[!!]`, then prints three lines: `Error:` with the cause, `How to fix:` with the action, and the link to the anchor of the failure in `docs/install/windows.md`. A start failure prints the last 20 lines of `data\log\equori.log` before them. Each failure has an anchor code (`w1-…`), kept stable across releases. |
| PW2.13 | The final block lists, one per line with values aligned on one column: the address (with the token of `setup.url` on a first installation), the folder, how to open equori (Start menu or tray icon), how to upgrade (the same command) and how to uninstall (Settings → Apps → equori). A first installation adds two lines in yellow: keep a copy of `data\secret.key` apart from the backups; without it, the bank connections cannot be read. |
| PW2.14 | Colors: green for `[ok]` and the success line, red for `[!!]` and `Error:`, cyan for the address, yellow for the `secret.key` lines. Without a console (redirected output) or with `NO_COLOR` set, the script writes the same lines without color and without in-place rewrite. |
| PW2.15 | `equori-cli.exe stop` and `uninstall` write their steps in the form of PW2.9 and PW2.12. |

Output of a first installation, `pt-BR`, as a reference for PW2.8 to PW2.13:

```
equori 0.9.0 · instalação em C:\Users\ana\AppData\Local\equori

  [ok] Verificações        Windows 11 x64, porta 8080 livre
  [ok] Download            31,2 MB                         4 s
  [ok] SHA-256             confere
  [ok] Arquivos            1.014 arquivos                  2 s
  [ok] Atalhos             Menu Iniciar, Iniciar com o Windows
  [ok] Início              resposta em /healthz            6 s

O equori está instalado.
  Endereço     http://127.0.0.1:8080/setup#token=3f9c…
  Pasta        C:\Users\ana\AppData\Local\equori
  Abrir        Menu Iniciar → equori, ou o ícone na bandeja
  Atualizar    execute de novo o mesmo comando
  Desinstalar  Configurações → Apps → equori

Guarde uma cópia de data\secret.key longe dos backups.
Sem ela, as conexões bancárias não podem ser lidas.
```

### PW3 Tray and execution

| ID | Rule |
|---|---|
| PW3.1 | `equori.exe` without arguments: when an instance of the same folder holds `equori.lock` (W-M6), it opens the browser at the configured address and exits. Otherwise it starts `serve` in the same process and shows the tray icon. |
| PW3.2 | After `/healthz` answers, the browser opens at the content of `setup.url` when the file exists (W5 of the 2026-10-27 design), else at the configured address. `--background` opens nothing. |
| PW3.3 | Tray menu: "Open equori" (also the action of a click on the icon), "Start with Windows" (check item that creates or removes the Startup shortcut of PW2.4), a separator, "Quit". The tooltip names the address. |
| PW3.4 | "Quit" and `equori-cli.exe stop` stop PostgreSQL through `pg_ctl stop` and end the process. `stop` waits up to 90 s for the lock of PW3.1 to be released. |
| PW3.5 | A start failure (port in use, refused data directory, PostgreSQL error) shows a Windows message box with the error and the path of the log, then exits. |
| PW3.6 | The standard output and error of `equori` and of `postgres.exe` go to `<data>\log\equori.log`, rotated at 10 MiB to `equori.log.1` (the rule of W-S4, moved out of `internal/platform/winsvc`). |
| PW3.7 | The tray and message box texts exist in `en` and `pt-BR`; the language is the Windows user interface language when it is Portuguese, else `en`. |
| PW3.8 | The tray code sits in a Windows-only file of `cmd/equori`; on Linux and macOS `equori` has no tray. `fyne.io/systray` is imported only from that file. |

### PW4 Data and configuration

| ID | Rule |
|---|---|
| PW4.1 | On Windows, the default data directory is `data\` beside the executable, and backups go to `backups\` beside it. W-M1 (`%ProgramData%\equori`) is removed. |
| PW4.2 | W-M2 to W-M9 of ADR 023 hold unchanged: bundled programs, protected DACL created with a missing data directory, socket without a TCP port, restricted token, Job Object. |

### PW5 Removed

`equori service` and `internal/platform/winsvc` (after PW3.6 moves the log rotation), `packaging/windows/equori.iss`, `scripts/windows-sign.ps1`, the signing secrets of `docs/operations/release.md`, the compose flow of `scripts/install.ps1`, and the installer flow of `scripts/windows-smoke.ps1` and `scripts/windows-upgrade-test.ps1`, which PW6 replaces. `docs/install/windows.md` keeps compose as a manual section for Docker users.

### PW6 CI and release

| ID | Rule |
|---|---|
| PW6.1 | The release job `windows` builds the bundle, runs `scripts/postgres-current.ps1`, builds both executables, assembles the zip, runs PW6.2 and uploads the zip and `install.ps1`. |
| PW6.2 | `scripts/windows-smoke.ps1 ZIP TAG` runs `install.ps1` against the local zip: no installed file has a `Zone.Identifier` stream; the shortcuts and the registry entry of PW2.4 exist; `/healthz` answers; `equori-cli.exe version` reports the tag; `POST /api/v1/setup` with the token of `setup.url` returns 201; an account and a transaction are recorded; `equori-cli.exe backup` writes a file in `backups\`; `equori-cli.exe stop` ends every `equori.exe` and `postgres.exe` of the folder; a second start keeps the transaction; a second run of `install.ps1` keeps the transaction; Microsoft Defender scans the folder (`MpCmdRun.exe -Scan -ScanType 3 -File`) with no threat; `equori-cli.exe uninstall --keep-data` removes the program, the shortcuts and the entry, and keeps `data\PG_VERSION`. |
| PW6.3 | From the second release that holds the zip, `scripts/windows-upgrade-test.ps1` installs the previous release, seeds it with `cmd/demoseed`, runs the new `install.ps1` over it and requires the snapshot of `upgrade-test.sh`. |
| PW6.4 | The CI job `windows` assembles the zip without uploading it and runs PW6.2 on a pull request that changes `cmd/equori`, `internal/platform/pgcluster`, `packaging/windows` or the scripts of PW2 and PW6. |

### PW7 Documents

| Document | Change |
|---|---|
| ADR 040 (new) | The per-user Windows form and the dependency `fyne.io/systray`; supersedes ADR 023 except W-P1 to W-P5 and W-M2 to W-M9; amends D9 of ADR 022 for Windows. |
| ADR 023 | Status: superseded by ADR 040. |
| `docs/specs/2026-10-27-distribution-windows-design.md` | Status line: superseded by this design. |
| `docs/install/windows.md`, `windows.pt-BR.md` | The command, the folder, the tray, upgrade, uninstall, the Smart App Control limit of PF2, compose as a manual section. |
| `docs/operations/release.md` | Signing secrets removed. |

## Known limits

| Limit | Effect | Stated in |
|---|---|---|
| PF2 | With Smart App Control on, Windows blocks `equori.exe`; the person can only turn Smart App Control off. | `docs/install/windows.md` |
| Logoff and shutdown | Whether `fyne.io/systray` passes the end-of-session message is not measured. Without it, Windows ends the process, the Job Object ends `postgres.exe`, and the next start runs WAL recovery; with `fsync` on, no committed transaction is lost. | ADR 040 |

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: no regional value. The language of PW3.7 follows the Windows interface language; the script keeps its rule of PF5. |
| R2 | A language other than Portuguese gets `en` (PW3.7). |
| R3 | Does not apply: no value set. |
| R4 | Does not apply: no extension point. |
| R5 | The tray and message box texts of PW3.3 to PW3.5 and the prompt of PW2.6 in `en` and `pt-BR`, in a Go table beside the tray code (the web catalog is not loaded before the server starts); the script texts of PW2 in `en` and `pt-BR`, in the form of PF5. |
| R6 | Does not apply: no screen writes a number or a date. |
| C1 to C4 | Does not apply: no amount. |
| T1, T2 | Does not apply: no date. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | "Start with Windows" is the presence of a shortcut in the Startup folder, not a stored setting. The address is a host value in `equori.env` (PW2.3). |
| D1 to D4 | Does not apply: no table, schema or fact changes. |
| D5 | Does not apply: no field of the diagnostic file. |
| S1 | Does not apply: no operation in `api/openapi.yaml`. |
| S2 | Does not apply: no screen. |
| S3 | Does not apply: no screen changes; the installation guide is `docs/install/windows.md` (PW7). |
| S4 | Does not apply. |
| X1 | Does not apply: no scenario of `docs/domain/06-scenarios.md`; PW6.2 is the acceptance test. |
| X2 | Does not apply. |

## Verification

| Rule | Test |
|---|---|
| PW1, PW2, PW3.1 to PW3.4, PW4 | PW6.2 on `windows-latest` |
| PW2.8 to PW2.14 | PW6.2 captures the redirected output of `install.ps1` and compares its lines, durations masked, with a golden file per language |
| PW3.6 | the rotation test moved with the log code |
| PW3.7 | a table test of the language choice |
| PW3.8 | `go vet` and `golangci-lint` with `GOOS=windows` and on Linux |
| PW6.3 | from the second release |

## Calls left to the builder

- The signal between `equori-cli.exe stop` and the running instance (named event, local endpoint or lock wait), within PW3.4.
- The icon file of the tray, from the existing mark.
- The source of the Smart App Control state of PW2.10 (the registry value `VerifiedAndReputablePolicyState` under `HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy` is the candidate; the builder confirms it on the runner). Without a reliable source, the check is dropped and the limit stays in the guide.
- Whether `scripts/windows-postgres.ps1` passes PW6.2 unchanged; a failure is fixed inside it.

## Sources

- Downloads and the Mark of the Web: https://textslashplain.com/2016/04/04/downloads-and-the-mark-of-the-web/
- Smart App Control FAQ: https://support.microsoft.com/windows/smart-app-control-faq-285ea03d-fa88-4d56-882e-6698afdb7003
- fyne-io/systray: https://github.com/fyne-io/systray
