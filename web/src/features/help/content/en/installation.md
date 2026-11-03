# Install and maintain equori

This page covers the files of an installation made with Docker Compose. It also covers the commands to upgrade, stop, start and remove it. The guide of each system holds the first installation.

## The installation directory

The installation command writes `compose.yaml`, `env.example`, `.env` and the folder `copies` in one directory. On Linux the directory is `~/equori`. The command prints it at the end: "equori is installed in <dir>."

Every command on this page runs inside that directory.

## Keep a copy of the .env file

The file `.env` holds the secret key. Without the key, equori cannot read the bank connections.

Keep a copy of `.env` apart from the backups. A backup does not contain the secret key.

## Upgrade

Run the installation command again. It installs the latest release. Before it migrates the data, equori makes a backup.

## Going back

In the installation directory:

1. Run the installation command of the earlier version, with `<version>` replaced by its number, such as `1.0.0`. When it ends with the address, equori is back on that version.

```sh
curl -fsSL https://github.com/andrelopes-code/equori/releases/download/v<version>/install.sh | sh
```

On Windows, in PowerShell:

```powershell
irm https://github.com/andrelopes-code/equori/releases/download/v<version>/install.ps1 | iex
```

2. When it stops with "equori did not answer", and the log lines above name "database schema is newer than this binary", the upgrade migrated the database: the earlier version refuses it (ADR 022, V4). The line also says "this binary knows up to <N>". List the backups and take the newest `pre-migration-<date>-s<N>.dump` with that `<N>`:

```sh
docker compose run --rm --no-deps --entrypoint ls app /backups
```

3. Restore it, with `<file>` replaced by its name. The data returns to the moment before the upgrade.

```sh
docker compose stop app
docker compose cp app:/backups/<file> .
docker compose cp <file> db:/tmp/restore.dump
docker compose exec -T db dropdb -U equori --force equori
docker compose exec -T db createdb --template=template0 --locale-provider=builtin --builtin-locale=C.UTF-8 -U equori equori
docker compose exec -T db pg_restore -U equori --no-owner --exit-on-error -d equori /tmp/restore.dump
docker compose start app
```

## Start and stop

```sh
docker compose stop
docker compose start
```

## Where the backups and the copies are

The automatic backups live in the volume `backups`. The encrypted copies live in the folder `copies` next to `compose.yaml`. The variable `EQUORI_COPY_FOLDER` in `.env` selects another folder.

Read their dates and set the copy password in [Settings](/settings), in the pane **Backup**. When a backup or a copy is late, see [Troubleshooting](/help/troubleshooting).

## Remove equori

- `docker compose down` keeps the data.
- `docker compose down -v` also deletes the database and the volume of the backups.

## A new installation

The first installation follows the guide of the system:

- [Linux](https://github.com/andrelopes-code/equori/blob/main/docs/install/linux.md)
- [macOS](https://github.com/andrelopes-code/equori/blob/main/docs/install/macos.md)
- [Windows](https://github.com/andrelopes-code/equori/blob/main/docs/install/windows.md)
