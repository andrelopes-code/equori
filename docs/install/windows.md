Portuguese: [windows.pt-BR.md](windows.pt-BR.md)

# Install on Windows

## Requirements

- Windows 10 version 1803 or later, or Windows 11, on an x64 or Arm processor.
- No Docker, Windows Subsystem for Linux, virtualization or administrator rights.

## Installation

Run the command in PowerShell:

```powershell
irm https://github.com/andrelopes-code/equori/releases/latest/download/install.ps1 | iex
```

The command downloads the release, checks its SHA-256 against `SHA256SUMS`, extracts it into `%LOCALAPPDATA%\equori`, creates the Start menu shortcut "equori" and starts equori. The command shows steps in the order Checks, Download, SHA-256, Stop, Files, Shortcuts and Start, then prints the address and the folder.

Two environment variables set before the command change its behavior:

- `EQUORI_DIR` selects another folder: `$env:EQUORI_DIR = 'D:\equori'`.
- `EQUORI_LANG` selects the language of the command, `en` or `pt-BR`. Without it, the command uses the Windows language.

The folder `<folder>\data` holds the database, `equori.env`, `secret.key`, the backups and the log `data\log\equori.log`. The program files and `data` share one folder.

Keep a copy of `<folder>\data\secret.key` apart from the backups: without it, the bank connections cannot be read.

## First access

The browser opens the address with the token, `http://127.0.0.1:8080` by default. The form asks for email, password, language, region, base currency, book name, time zone and the update check. An icon in the notification area (tray) shows that equori runs.

equori listens on `127.0.0.1` only. `EQUORI_HTTP_ADDR` in `<folder>\data\equori.env` selects another address ([configuration.md](configuration.md)).

## Daily use

The tray icon has a menu:

- "Open equori" opens the address in the browser. A click on the icon does the same.
- "Start with Windows" is a check item. It writes or deletes the value `equori` under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. The item starts checked after the first installation. Settings → Apps → Startup lists the same value with its own switch.
- "Quit" stops equori and PostgreSQL.

The tooltip of the icon names the address. The Start menu shortcut "equori" opens equori after "Quit". A second start of equori on the same folder opens the browser and exits.

`equori-cli.exe`, in the folder of the installation, runs these commands in PowerShell:

```powershell
cd "$env:LOCALAPPDATA\equori"
.\equori-cli.exe backup --out equori.dump
.\equori-cli.exe stop
.\equori-cli.exe restore equori.dump
.\equori-cli.exe version
```

- `backup` writes a `pg_dump` archive.
- `stop` stops equori and waits up to 90 seconds.
- `restore` replaces the database with an archive and refuses to run while equori runs. Run `stop` first, then start equori from the Start menu.
- `version` prints the installed version.

## Upgrade

Run the installation command again. The command stops the running equori, replaces the program files and keeps `data`. `serve` backs up the data before it migrates (ADR 022, B3). The state of "Start with Windows" stays as it was.

When the installed version equals the release, the command prints "equori {v} is already installed in {dir}." and stops. The switch `-Reinstall` runs the installation again and repairs a folder:

```powershell
& ([scriptblock]::Create((irm https://github.com/andrelopes-code/equori/releases/latest/download/install.ps1))) -Reinstall
```

## Removal

Settings → Apps → equori runs `install.ps1 -Uninstall` from the folder of the installation. The command stops equori, removes the program files, the shortcut, the Run value and the entry of Settings → Apps, then asks:

```text
Delete the data in <folder>\data, backups included? [y/N]
```

The default answer is No: the data stays in `<folder>\data`. A later installation in the same folder finds it.

The same removal runs from PowerShell, with `-Yes` to delete the data without asking or `-KeepData` to keep it without asking:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\equori\install.ps1" -Uninstall -KeepData
```

When a program holds a file of the folder, the command lists up to five paths and stops with exit code 1. Close the programs that use them, then run the removal again.

## Limits

- Smart App Control: with Smart App Control on, Windows blocks `equori.exe` because the release has no code signature. The command stops at [w5](#w5-smart-app-control-is-on). Turning Smart App Control off is the only way to run equori.
- SmartScreen: the command shows no SmartScreen screen. The screen appears when a browser downloads the zip of the release instead of the command.

## Troubleshooting

Each entry quotes the error printed by the installation command, then gives the fix. Every stop of the command ends with the line `How to fix: <url>` that links the entry. `{dir}`, `{url}`, `{port}`, `{process}`, `{ver}`, `{arch}` and `{error}` stand for values the command prints.

### w1 Windows is too old

Error: "equori needs Windows 10 version 1803 or later; this computer runs {ver}."

How to fix: Update Windows, then run the command again.

### w2 Unsupported processor

Error: "equori runs on x64 and Arm processors; this computer reports {arch}."

How to fix: Use a computer with an x64 or Arm processor.

### w3 Folder is not writable

Error: "{dir} does not accept new files."

How to fix: Set $env:EQUORI_DIR to another folder, then run the command again.

### w4 Port in use

Error: "Port {port} is in use by {process}."

How to fix: Close that program, or set EQUORI_HTTP_ADDR=127.0.0.1:8081 in {dir}\data\equori.env, then run the command again.

### w5 Smart App Control is on

Error: "Smart App Control is on: Windows blocks programs without a code signature, and equori has none."

How to fix: Turn it off in Windows Security → App & browser control → Smart App Control, then run the command again. Turning it back on may require resetting Windows.

### w6 Download failed

Error: "The download of {url} failed after 3 attempts: {error}."

How to fix: Check the internet connection, then run the command again.

### w7 Checksum mismatch

Error: "The downloaded file does not match SHA256SUMS of the release."

How to fix: Run the command again; if it repeats, report it at github.com/andrelopes-code/equori/issues.

### w8 equori does not stop

Error: "The running equori did not stop within 90 seconds."

How to fix: Quit equori from its tray icon, then run the command again.

### w9 equori does not start

Error: "equori did not answer on {url}healthz within 120 seconds; the last lines of its log are above."

How to fix: Read {dir}\data\log\equori.log; it names the cause.

## Compose for Docker users

The command of the previous sections does not run Docker Compose. This section is the manual form for a person who runs equori with Docker. Linux uses the same files through [linux.md](linux.md).

### Compose requirements

- Windows Subsystem for Linux: run `wsl --install` in a terminal opened as administrator, then restart Windows (<https://learn.microsoft.com/windows/wsl/install>).
- Docker Desktop with "Use the WSL 2 based engine" turned on (<https://docs.docker.com/desktop/setup/install/windows-install/>).

### Compose installation

1. Download `compose.yaml` and `env.example` of the release into an installation directory: <https://github.com/andrelopes-code/equori/releases/latest/download/compose.yaml> and <https://github.com/andrelopes-code/equori/releases/latest/download/env.example>.
2. Write `.env` as in steps 2 to 5 of I5, with a new password in `POSTGRES_PASSWORD`.
3. Run `docker compose up -d` in the installation directory.

Keep a copy of `.env` apart from the backups: it holds the secret key, without which the bank connections cannot be read.

### Compose first access

The browser opens `http://127.0.0.1:8080`. The form asks for the same fields as the native form.

### Compose upgrade

Replace `compose.yaml` with the file of the new release, then run `docker compose pull` and `docker compose up -d`. `serve` backs up the data before it migrates (ADR 022, B3).

A change to the services goes in `compose.override.yaml` in the installation directory: Docker Compose merges that file over `compose.yaml`.

### Compose going back

In the installation directory:

1. Replace `compose.yaml` with the file of the earlier version, with `<version>` replaced by its number, such as `1.0.0`, then run `docker compose up -d`.

```powershell
curl.exe -fsSLo compose.yaml https://github.com/andrelopes-code/equori/releases/download/v<version>/compose.yaml
docker compose up -d
```

2. When equori does not answer, and the log lines name "database schema is newer than this binary", the upgrade migrated the database: the earlier version refuses it (ADR 022, V4). The line also says "this binary knows up to <N>". List the backups and take the newest `pre-migration-<date>-s<N>.dump` with that `<N>`:

```powershell
docker compose run --rm --no-deps --entrypoint ls app /backups
```

3. Restore it, with `<file>` replaced by its name. The data returns to the moment before the upgrade.

```powershell
docker compose stop app
docker compose cp app:/backups/<file> .
docker compose cp <file> db:/tmp/restore.dump
docker compose exec -T db dropdb -U equori --force equori
docker compose exec -T db createdb --template=template0 --locale-provider=builtin --builtin-locale=C.UTF-8 -U equori equori
docker compose exec -T db pg_restore -U equori --no-owner --exit-on-error -d equori /tmp/restore.dump
docker compose start app
```

### Compose start and stop

In the installation directory:

```sh
docker compose stop
docker compose start
```

### Compose removal

- `docker compose down` keeps the data.
- `docker compose down -v` deletes the database and the backups volume.

### Compose troubleshooting

Each entry quotes a message printed by the compose installation command (`install.sh` on Linux) or by equori, then gives the correction.

#### I1 Docker is not installed

Message: "Docker is not installed or not on the PATH. Install Docker, then run this command again."

Correction: Install Docker as in Compose requirements, then run the installation command again.

#### I2 Docker does not answer

Message: "Docker does not answer. Start Docker Desktop, or on Linux start the docker service and add the user to the docker group."

Correction: Start Docker Desktop, or on Linux start the docker service and add the user to the `docker` group, then run the installation command again.

#### I3 Docker Compose v2 is missing

Message: "Docker Compose v2 is missing: docker compose version fails. Install the Compose plugin."

Correction: Install the Compose plugin until `docker compose version` succeeds, then run the installation command again.

#### I4 Docker does not use WSL 2

Message without `wsl.exe`: "Windows Subsystem for Linux is missing. Run wsl --install in a terminal opened as administrator, restart Windows, then run this command again."

Message with `wsl.exe`: "Docker Desktop does not use the WSL 2 engine. Turn on Settings > General > "Use the WSL 2 based engine", then run this command again."

Correction: Without `wsl.exe`, run `wsl --install` in a terminal opened as administrator and restart Windows. Otherwise, turn on Settings > General > "Use the WSL 2 based engine" in Docker Desktop. Then run the installation command again.

#### I5 compose.yaml without .env

Message: "<dir> holds compose.yaml without .env: an installation made without this script. Write .env with the database password of that installation; the guide shows how."

Steps:

1. Download `env.example` of the release into the installation directory: <https://github.com/andrelopes-code/equori/releases/latest/download/env.example>.
2. Copy it to `.env`.
3. Set `POSTGRES_PASSWORD` to the password of the earlier command: `change-me` in the earlier README, `equori` without one.
4. Set `EQUORI_SECRET_KEY` to the output of `docker run --rm alpine sh -c 'head -c 32 /dev/urandom | base64'`.
5. Set `EQUORI_PORT=8080`.
6. Run the installation command again.

#### I6 Download failed

Message: "The download of <url> failed. Check the internet connection, then run this command again."

Correction: Check the internet connection, then run the installation command again.

#### I7 No free port

Message: "Ports 8080 to 8099 are all in use. Stop a program that uses one of them, then run this command again."

Correction: Stop a program that uses one of the ports 8080 to 8099, then run the installation command again.

#### I8 equori does not start

Message: "equori did not answer on http://127.0.0.1:<port>/healthz within 180 seconds; its last log lines are above."

Correction: Read the log lines printed above the message. `docker compose logs app` in the installation directory prints them again.

#### C1 Invalid configuration

Message: `invalid configuration (docs/install/configuration.md):`

Correction: Correct the lines of `.env` that the report names, then run `docker compose up -d`. [configuration.md](configuration.md) lists every variable.

#### C2 Unknown variable

Message: `environment variable unknown`

Correction: The log names a variable that equori does not read. Correct its name in `.env`.

#### C3 Database unreachable

Message: `cannot connect to the database of EQUORI_DATABASE_URL`

Correction: Run `docker compose ps db` to check the database service. A `POSTGRES_PASSWORD` changed after the first start does not change the password stored in the database (ADR 022, B5).

#### C4 Port in use

Message: `EQUORI_HTTP_ADDR`

Correction: The message ends with "expected a free host:port". With compose, `EQUORI_PORT` in `.env` selects the port; set a free one, then run `docker compose up -d`.

#### C5 Secret key not set

Message: `EQUORI_SECRET_KEY is not set: bank connections, the second factor and the copy password are unavailable`

Correction: An installation made before P14 has no key. Add `EQUORI_SECRET_KEY` to `.env` as in I5, then run `docker compose up -d`.
