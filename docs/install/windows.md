Portuguese: [windows.pt-BR.md](windows.pt-BR.md)

# Install on Windows

## Prerequisites

- Windows Subsystem for Linux: run `wsl --install` in a terminal opened as administrator, then restart Windows (<https://learn.microsoft.com/windows/wsl/install>).
- Docker Desktop with "Use the WSL 2 based engine" turned on (<https://docs.docker.com/desktop/setup/install/windows-install/>).

## Installation

Run the command in a terminal PowerShell:

```powershell
irm https://github.com/andrelopes-code/equori/releases/latest/download/install.ps1 | iex
```

The command installs equori in `%USERPROFILE%\equori` and writes `compose.yaml`, `env.example`, `.env` and the folder `copies` there.

At the end the command prints: "equori is installed in <dir>." and "Address: <url>".

Keep a copy of `<dir>/.env` apart from the backups: it holds the secret key, without which the bank connections cannot be read.

## First access

The browser opens the address with the token. The form asks for email, password, language, region, base currency, book name, time zone and the update check. While no user exists, running the command again prints the address again.

## Upgrade

Run the installation command again. `serve` backs up the data before it migrates (ADR 022, B3).

## Start and stop

In the installation directory:

```sh
docker compose stop
docker compose start
```

## Removal

- `docker compose down` keeps the data.
- `docker compose down -v` deletes the database and the backups volume.

## Troubleshooting

Each entry quotes the message printed by the installation command or by equori, then gives the correction. Every stop of the installation command ends with the line `Guide: <url>` that links the entry.

### I1 Docker is not installed

Message: "Docker is not installed or not on the PATH. Install Docker, then run this command again."

Correction: Install Docker as in Prerequisites, then run the installation command again.

### I2 Docker does not answer

Message: "Docker does not answer. Start Docker Desktop, or on Linux start the docker service and add the user to the docker group."

Correction: Start Docker Desktop, or on Linux start the docker service and add the user to the `docker` group, then run the installation command again.

### I3 Docker Compose v2 is missing

Message: "Docker Compose v2 is missing: docker compose version fails. Install the Compose plugin."

Correction: Install the Compose plugin until `docker compose version` succeeds, then run the installation command again.

### I4 Docker does not use WSL 2

Message: "Without `wsl.exe`: Windows Subsystem for Linux is missing. Run wsl --install in a terminal opened as administrator, restart Windows, then run this command again. Otherwise: Docker Desktop does not use the WSL 2 engine. Turn on Settings > General > "Use the WSL 2 based engine", then run this command again."

Correction: Without `wsl.exe`, run `wsl --install` in a terminal opened as administrator and restart Windows. Otherwise, turn on Settings > General > "Use the WSL 2 based engine" in Docker Desktop. Then run the installation command again.

### I5 compose.yaml without .env

Message: "<dir> holds compose.yaml without .env: an installation made without this script. Write .env with the database password of that installation; the guide shows how."

Steps:

1. Download `env.example` of the release into the installation directory: <https://github.com/andrelopes-code/equori/releases/latest/download/env.example>.
2. Copy it to `.env`.
3. Set `POSTGRES_PASSWORD` to the password of the earlier command: `change-me` in the earlier README, `equori` without one.
4. Set `EQUORI_SECRET_KEY` to the output of `docker run --rm alpine sh -c 'head -c 32 /dev/urandom | base64'`.
5. Set `EQUORI_PORT=8080`.
6. Run the installation command again.

### I6 Download failed

Message: "The download of <url> failed. Check the internet connection, then run this command again."

Correction: Check the internet connection, then run the installation command again.

### I7 No free port

Message: "Ports 8080 to 8099 are all in use. Stop a program that uses one of them, then run this command again."

Correction: Stop a program that uses one of the ports 8080 to 8099, then run the installation command again.

### I8 equori does not start

Message: "equori did not answer on http://127.0.0.1:<port>/healthz within 180 seconds; its last log lines are above."

Correction: Read the log lines printed above the message. `docker compose logs app` in the installation directory prints them again.

### C1 Invalid configuration

Message: `invalid configuration (docs/install/configuration.md):`

Correction: Correct the lines of `.env` that the report names, then run `docker compose up -d`. [configuration.md](configuration.md) lists every variable.

### C2 Unknown variable

Message: `environment variable unknown`

Correction: The log names a variable that equori does not read. Correct its name in `.env`.

### C3 Database unreachable

Message: `cannot connect to the database of EQUORI_DATABASE_URL`

Correction: Run `docker compose ps db` to check the database service. A `POSTGRES_PASSWORD` changed after the first start does not change the password stored in the database (ADR 022, B5).

### C4 Port in use

Message: `EQUORI_HTTP_ADDR`

Correction: The message ends with "expected a free host:port". With compose, `EQUORI_PORT` in `.env` selects the port; set a free one, then run `docker compose up -d`.

### C5 Secret key not set

Message: `EQUORI_SECRET_KEY is not set: bank connections, the second factor and the copy password are unavailable`

Correction: An installation made before P14 has no key. Add `EQUORI_SECRET_KEY` to `.env` as in I5, then run `docker compose up -d`.
