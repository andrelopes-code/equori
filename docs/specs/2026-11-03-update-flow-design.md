# Update flow

Rules A192 to A197; scenarios S268 to S272 of `docs/domain/06-scenarios.md`. Section 9.4.3 of `docs/domain/09-roadmap.md`.

## Goal

A release takes the developer the checks a person must make and nothing a machine can make. An installed instance tells its admin that a newer release exists, which command upgrades it, and how to go back.

## Current state

| Part | Today | Where |
|---|---|---|
| Release checklist | 9 steps. Steps 2 and 3 compare `ArchiveVersion` with its fixtures by hand; `make check` of step 1 already fails without them (`TestImportArchiveFixtures`, ADR 021 V6, V7). Step 5 writes `Export archive_version: <N>` into the notes by hand (V9). | `docs/operations/release.md` |
| Windows installer | The README states that every release carries `equori_<version>_windows_amd64_setup.exe`. The job publishes it only with the signing secrets (W-R6); `v1.0.0-rc.1` has none. | `README.md` |
| Notice | "Version {version} of equori is available." and a link to the notes. It names no command. | `web/src/features/instance/release-notice.tsx` |
| Script | A re-run upgrades; the output does not name the version it replaces. | `scripts/install.sh`, `scripts/install.ps1` |
| Going back | No guide covers it. `serve` refuses a database with a migration it does not know (ADR 022, V4); the pre-migration backup sits in the volume `backups` (B3, B5). | `docs/install/*.md` |

## A192 Archive version of a release

1. `equori version` prints a fourth line, `archive <N>`, with `ArchiveVersion` of the reporting module.
2. The job `release` extracts `equori` from `equori_<version>_linux_amd64.tar.gz`, reads the line `archive <N>`, and creates the release with `--notes "Export archive_version: <N>"` beside `--generate-notes`. A binary without the line fails the job before the release exists.
3. `docs/operations/release.md` drops steps 2, 3 and 5. Step 1 names the tests that cover 2 and 3. Reason: a step a test or a job performs is a step a person can forget.

## A193 Windows installer in the README

The README states that a release carries `equori_<version>_windows_amd64_setup.exe` only when the job `windows` signed it (ADR 023, W-R6), and that the supported form on Windows is the command of `docs/install/windows.md`. Reason: the README promised a file that `v1.0.0-rc.1` does not carry.

## A194 Distribution of an instance

1. `compose.yaml` sets `EQUORI_DISTRIBUTION=compose` on the service `app`. The variable is in the configuration map (A160) with the values `compose` and empty.
2. `VersionStatus` gains `distribution`: `compose` when the variable says so, `managed` in managed mode (ADR 022, M1), `other` otherwise. Reason: the upgrade of each form differs, and a command for another form is a trap.

## A195 Upgrade notice

1. The notice reads "Version {latest} of equori is available. This instance runs {version}.", followed by the link "See what changed" to the release page. Its actions: "How to upgrade" (main) and "Dismiss".
2. "How to upgrade" opens a dialog by `distribution`:
   - `compose`: "Run one of these commands on the computer where equori is installed.", then two commands, each with its label and a copy button: Windows (PowerShell) `irm https://github.com/andrelopes-code/equori/releases/download/{latest}/install.ps1 | iex`; macOS and Linux (Terminal) `curl -fsSL https://github.com/andrelopes-code/equori/releases/download/{latest}/install.sh | sh`. `{latest}` is the tag the notice names, so a pre-release notice installs that pre-release. Below: "The data stays. Before it changes the database, equori writes a backup."
   - `managed`: "Install the new version the way this one was installed: `brew upgrade equori` with Homebrew, or the Windows installer of the release page." and the release page link.
   - `other`: "Install the new version the way this one was installed. The release page holds its files."
   - Every form: the link "Upgrade and going back" to the help page `installation`, which gains the section of A197.
3. Texts in both catalogs. Reason: the admin who reads the notice is the person who must act, and the command is the whole action.

## A196 Version in the script output

On an upgrade, the second step of A190.2 is "Version {current} → {new}", where {current} is the tag of the image of the running `app` container (`docker compose ps --format '{{.Image}}' app`, the part between `:` and `-standalone`). The same version reads "Version {new}, already installed". No running container keeps "Files of version {new}". Reason: an upgrade that does not say what it replaced gives no control.

## A197 Going back

Each guide (`docs/install/<system>.md` and its pt-BR twin) and the help page `installation` gain the section "Going back", after "Upgrade":

1. The installation command of the earlier version: `releases/latest/download` replaced by `releases/download/v<version>`. An upgrade that applied no migration is undone here.
2. When that command stops with I8 and the log lines name "database schema is newer than this binary" (ADR 022, V4), the line also names "this binary knows up to <N>". `docker compose run --rm --no-deps --entrypoint ls app /backups` lists the backups; the file to restore is the newest `pre-migration-<date>-s<N>.dump` with that `<N>`. Reason: the newest pre-migration file of any schema can predate the last upgrade, and its restore would lose what was recorded since.
3. `docker compose stop app`, `docker compose cp` of the file out of `app` and into `db`, the drop, create and `pg_restore` of `docs/operations/backup.md` (Compose) reading `/tmp/restore.dump` inside `db`, then `docker compose start app`. Reason: PowerShell refuses the `<` redirection of `backup.md`, so the file enters the container instead.

## Scenarios

| ID | Scenario | Expected |
|---|---|---|
| S268 | `equori version` | Four lines; the fourth is `archive <ArchiveVersion>` |
| S269 | `distribution` `compose`, latest `1.0.1`, instance `1.0.0`; "How to upgrade"; copy of the Windows command | The dialog shows both commands; the clipboard holds the Windows command |
| S270 | `distribution` `managed` | The dialog shows no `irm` or `curl` command |
| S271 | A second run of the script on the same version | The second step reads "Version {version}, already installed" |
| S272 | `EQUORI_DISTRIBUTION=compose`, then unset, then managed mode | `distribution` `compose`, `other`, `managed` |

## Out of scope

- Upgrade from inside the application. It needs the Docker socket inside a container, which gives that container the host.
- Automatic upgrades. The admin chooses the moment; the backup of B3 and the notes are read first.
- A notice of pre-releases. `releases/latest` serves none; testers follow the release page.
