# equori

Self-hosted personal finance manager.

Status: early development. No features yet.

Security reports: see [SECURITY.md](SECURITY.md).

## Run

```sh
POSTGRES_PASSWORD=change-me docker compose up -d
```

The app listens on `http://localhost:8080`. `GET /healthz` returns `200` when the database is reachable.

| Variable | Default | Description |
|---|---|---|
| `EQUORI_DATABASE_URL` | set by `compose.yaml` | PostgreSQL connection URL |
| `EQUORI_HTTP_ADDR` | `:8080` | HTTP listen address |
| `EQUORI_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `POSTGRES_PASSWORD` | `equori` | Database password used by `compose.yaml` |

Data lives in the `pgdata` Docker volume. Back it up with:

```sh
docker compose exec db pg_dump -U equori equori > equori.sql
```

The Postgres major version is pinned to 18. To upgrade the major version, dump the database, recreate the volume with the new image and restore the dump.

## Development

Requirements: Go 1.27, Docker, make.

```sh
make hooks    # pre-commit runs make check
make db-up    # local Postgres on 127.0.0.1:54329 (EQUORI_DEV_DB_PORT)
make dev      # run the app
make check    # format check, tidy check, lint, test (starts Postgres)
```

## License

MIT
