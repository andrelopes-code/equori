# Backup and restore

The database holds every fact of an instance, attachments included (D2). A backup is a
`pg_dump` of the `equori` database in custom format. Commands run from the directory of
`compose.yaml`.

## Backup

```sh
docker compose exec -T db pg_dump -U equori -Fc -d equori > equori-$(date +%F).dump
```

The application keeps running. The dump is consistent: `pg_dump` reads one snapshot.

The dump contains password hashes, session tokens and every financial record. Store it
where only the owner can read it.

## Restore

Restore replaces the instance's data with the dump:

```sh
docker compose stop app
docker compose exec -T db dropdb -U equori --force equori
docker compose exec -T db createdb -U equori equori
docker compose exec -T db pg_restore -U equori --no-owner --exit-on-error -d equori < equori-2026-10-16.dump
docker compose start app
```

On start the application applies the migrations that are newer than the dump (N11).
Derived tables are part of the dump; `docker compose exec app /equori reporting rebuild`
recomputes them when in doubt.

## Verification

`internal/server/backup_test.go` dumps a database populated through the API, restores it
into an empty database with the commands above and requires identical row counts of
every table, account balances, daily balance series, attachment content and triggers,
before and after rebuilding the derived tables (N12).
