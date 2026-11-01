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
