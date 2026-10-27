# Backup and restore

The database holds every fact of an instance, attachments included (D2). A backup is a
`pg_dump` of the `equori` database in custom format (ADR 022, D4).

The dump contains password hashes, session tokens and every financial record. Store it
where only the owner can read it.

## Backup

```sh
equori backup [--out FILE]
```

The command writes the dump with mode 0600 and prints its path. The default name is
`equori-<YYYY-MM-DD>-s<schema version>.dump`: in managed mode inside the backup directory,
in external mode (`EQUORI_DATABASE_URL` set) in the current directory. `pg_dump` comes from
`EQUORI_POSTGRES_BIN` or `PATH`, and its major must be at least the server's. The application
keeps running; `pg_dump` reads one consistent snapshot.

In the standalone image: `docker exec equori equori backup`.

On Windows: `equori backup` in a terminal of the account that installed equori. The dump lands
in `%ProgramData%\equori\backups`, which only SYSTEM, the service and that account can read. A
dump written with `--out` elsewhere takes the permissions of its folder, which the mode 0600 of
the other systems does not replace (ADR 023, W-B1).

Compose keeps the dump inside the `db` container, because the application image holds no
`pg_dump`. Commands run from the directory of `compose.yaml`:

```sh
docker compose exec -T db pg_dump -U equori -Fc -d equori > equori-$(date +%F).dump
```

## Automatic backups

Managed mode writes a backup into the backup directory before it applies pending migrations
(`pre-migration-*.dump`) and once per 24 hours while `serve` runs (`periodic-*.dump`). It keeps
the last 7 periodic and the last 3 pre-migration files. The backup directory is `backups/` in
the data directory; `EQUORI_BACKUP_DIR` overrides it.

`backups/` sits on the same disk as the data. A disk failure loses both; copy the files to
another disk or host.

## Restore

```sh
equori restore FILE
```

Stop `equori serve` first: in managed mode the command refuses to run beside it. On Windows,
run `equori service stop`, then `equori restore FILE`, then `Restart-Service equori`, all in an
administrator terminal. The command
drops the database, recreates it from `template0` with the builtin `C.UTF-8` locale, and runs
`pg_restore --no-owner --exit-on-error`. A dump of a schema version above the binary's highest
migration is refused before anything is dropped. On the next start the application applies the
migrations that are newer than the dump (N11). Derived tables are part of the dump;
`equori reporting rebuild` recomputes them when in doubt.

Compose:

```sh
docker compose stop app
docker compose exec -T db dropdb -U equori --force equori
docker compose exec -T db createdb --template=template0 --locale-provider=builtin --builtin-locale=C.UTF-8 -U equori equori
docker compose exec -T db pg_restore -U equori --no-owner --exit-on-error -d equori < equori-2026-10-16.dump
docker compose start app
```

## Moving between forms

A dump of any form restores into any other form (B4): a computer to a server, compose to the
standalone image, Windows to compose and back (tested in ci, ADR 023, W-R2). Take `equori backup` (or the compose dump) on the source, copy the file, and
run `equori restore FILE` (or the compose restore) on the target.

## Secret key

The dump does not contain the secret key (ADR 008). Keep the key apart from the dump: a
restore without it keeps every ledger fact and loses only the stored integration credentials,
which the owner enters again. `equori secrets key` prints the key in use; set it as
`EQUORI_SECRET_KEY` on the instance that receives the restore.

## Verification

`internal/server/backup_test.go` dumps a database populated through the API, restores it
into an empty database with the compose commands and requires identical row counts of
every table, account balances, daily balance series, attachment content and triggers,
before and after rebuilding the derived tables (N12). `internal/server/cluster_backup_test.go`
(`TestClusterBackupRestoresAcrossForms`) restores a dump of the compose form into a managed
cluster and back with the same comparisons (N28).
