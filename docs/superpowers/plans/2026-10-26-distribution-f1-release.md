# Distribution F1: Release Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One tag produces verified archives, images and release assets, and a binary never runs against a database written by a newer binary.

**Architecture:** `internal/platform/postgres` learns the binary's highest migration and refuses a database ahead of it. `equori version` prints the application version, the schema version and the minimum PostgreSQL major. A `make dist` target builds reproducible archives. `.github/workflows/release.yml` gates on `make check`, smoke-tests and attests every artifact, runs an upgrade test from the previous tag, and publishes a `compose.yaml` pinned to the tag.

**Tech Stack:** Go 1.27, goose v3 `Provider`, GNU make, bash, GitHub Actions, Docker Buildx.

**Spec:** `docs/superpowers/specs/2026-10-26-distribution-design.md` (phase F1: V3, V4, C1, R1 to R4, R7, D9 rows of F1).

## Global Constraints

- Minimum PostgreSQL major: 18 (`uuidv7()` in the migrations).
- Archive targets: linux/amd64, linux/arm64, darwin/amd64, darwin/arm64. Archive name: `equori_<version without v>_<os>_<arch>.tar.gz`, holding a directory of the same name with `equori`, `LICENSE`, `README.md`.
- Image tags stay `X.Y.Z`, `X.Y`, and `latest` only for a tag without `-` (spec V7).
- `compose.yaml` and the documentation never name `latest` (spec V7).
- Every English rule of `CLAUDE.md` applies: comments only for a non-obvious reason; errors `fmt.Errorf("verb object: %w", err)`; sentinels `ErrXxx`; tests table-driven where more than one case exists.
- Commits follow Conventional Commits; no commit mentions AI tools.
- GitHub Actions versions: keep the versions already in the workflows; new actions use `actions/attest-build-provenance@v4`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`.
- No new Go module dependency, no new web dependency.

## Review Focus

1. A database at a version the binary does not know: `serve` and every command must stop before touching it, with both versions in the message. Test in Task 1.
2. A fresh, empty database: the downgrade check must not refuse version 0. Test in Task 1.
3. Two `make dist` runs of one commit: identical `SHA256SUMS`. Check in Task 4.
4. `make db-up` and `make test` with `EQUORI_VERSION` unset: the changed `compose.yaml` must still parse. Check in Task 5.
5. The first tag, which has no predecessor: the upgrade job must succeed without testing. Check in Task 7 (the `steps.prev.outputs.tag == ''` branch).

---

### Task 1: Refuse a database ahead of the binary (V4)

**Files:**
- Modify: `internal/platform/postgres/postgres.go`
- Test: `internal/platform/postgres/postgres_test.go`

**Interfaces:**
- Produces:
  - `var ErrSchemaAhead = errors.New("database schema is newer than this binary")` in package `postgres`.
  - `const MinMajor = 18` in package `postgres` (minimum PostgreSQL major).
  - `func LatestVersion() (int64, error)`: the highest version among the embedded migrations.
  - `MigrateTo` returns an error wrapping `ErrSchemaAhead` when the database holds a version above `LatestVersion()`.

- [ ] **Step 1: Write the failing tests**

Append to `internal/platform/postgres/postgres_test.go` (add imports `errors`, `fmt`, `io`, `io/fs`, `log/slog`, `strings`, `github.com/andrelopes-code/equori/db`, `github.com/andrelopes-code/equori/internal/platform/postgres`):

```go
// The migration files are numbered 1 to N without gaps, so the highest version is their count.
func TestLatestVersion(t *testing.T) {
	t.Parallel()
	files, err := fs.Glob(db.Migrations, "migrations/*.sql")
	if err != nil {
		t.Fatal(err)
	}
	got, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}
	if got != int64(len(files)) {
		t.Fatalf("LatestVersion() = %d, want %d", got, len(files))
	}
}

// V4 of the distribution design: a database migrated by a newer binary is refused, untouched.
func TestMigrateRefusesNewerSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}
	ahead := latest + 1
	if _, err := pool.Exec(t.Context(), "INSERT INTO goose_db_version (version_id, is_applied) VALUES ($1, true)", ahead); err != nil {
		t.Fatal(err)
	}
	err = postgres.Migrate(t.Context(), pool, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if !errors.Is(err, postgres.ErrSchemaAhead) {
		t.Fatalf("Migrate() error = %v, want ErrSchemaAhead", err)
	}
	for _, want := range []string{fmt.Sprintf("version %d", ahead), fmt.Sprintf("up to %d", latest)} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("error %q does not contain %q", err, want)
		}
	}
}

func TestMigrateAcceptsEmptyDatabase(t *testing.T) {
	t.Parallel()
	pool := pgtest.Empty(t)
	if err := postgres.Migrate(t.Context(), pool, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatalf("Migrate() on an empty database: %v", err)
	}
}
```

- [ ] **Step 2: Run the tests and read the failures**

Run: `make db-test-up && go test -run 'TestLatestVersion|TestMigrateRefusesNewerSchema|TestMigrateAcceptsEmptyDatabase' ./internal/platform/postgres/`
Expected: build failure `undefined: postgres.LatestVersion` and `undefined: postgres.ErrSchemaAhead`.

- [ ] **Step 3: Implement in `internal/platform/postgres/postgres.go`**

- `LatestVersion`: `fs.Glob(db.Migrations, "migrations/*.sql")`; for each name, `filepath.Base`, take the part before the first `_`, `strconv.ParseInt(part, 10, 64)`; return the maximum. A name without a numeric prefix returns `fmt.Errorf("parse migration version %q: %w", name, err)`.
- `MigrateTo`: after `goose.NewProvider` and before `provider.UpTo`:

```go
	current, err := provider.GetDBVersion(ctx)
	if err != nil {
		return fmt.Errorf("read schema version: %w", err)
	}
	sources := provider.ListSources()
	latest := sources[len(sources)-1].Version
	if current > latest {
		return fmt.Errorf("%w: database at version %d, this binary knows up to %d; restore a backup taken before the upgrade, or run a release that knows version %d", ErrSchemaAhead, current, latest, current)
	}
```

- Declare `ErrSchemaAhead` with a one-line comment naming V4 of the distribution design, and `MinMajor = 18` with the comment `// MinMajor is the oldest PostgreSQL major the migrations run on: they call uuidv7().`

- [ ] **Step 4: Run the tests**

Run: `go test ./internal/platform/postgres/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/platform/postgres/postgres.go internal/platform/postgres/postgres_test.go
git commit -m "feat(platform): refuse a database migrated by a newer binary" -m "A binary that starts on a database holding a migration it does not
know would run its queries against a schema it was not built for.
Migrate now stops with ErrSchemaAhead and names both versions (V4 of
docs/superpowers/specs/2026-10-26-distribution-design.md)."
```

---

### Task 2: `equori version` prints schema and PostgreSQL minimum (V3)

**Files:**
- Modify: `cmd/equori/main.go` (the `case "version":` branch and the `starting equori` log line)
- Create: `cmd/equori/version.go`
- Test: `cmd/equori/version_test.go`

**Interfaces:**
- Consumes: `postgres.LatestVersion()`, `postgres.MinMajor` (Task 1); `buildVersion()` (exists in `main.go`).
- Produces: `func versionText(app string) (string, error)` returning exactly three lines:

```
equori <app>
schema <LatestVersion>
postgresql >= <MinMajor>
```

each ending in `\n`. Task 6 (release smoke) and F3 (Homebrew test) parse the first line.

- [ ] **Step 1: Write the failing test** in `cmd/equori/version_test.go` (package `main`):

```go
func TestVersionText(t *testing.T) {
	t.Parallel()
	latest, err := postgres.LatestVersion()
	if err != nil {
		t.Fatal(err)
	}
	got, err := versionText("v0.1.0")
	if err != nil {
		t.Fatal(err)
	}
	want := fmt.Sprintf("equori v0.1.0\nschema %d\npostgresql >= 18\n", latest)
	if got != want {
		t.Fatalf("versionText() = %q, want %q", got, want)
	}
}
```

- [ ] **Step 2: Run it**

Run: `go test -run TestVersionText ./cmd/equori/`
Expected: FAIL, `undefined: versionText`.

- [ ] **Step 3: Implement** `versionText` in `cmd/equori/version.go`. In `main.go`, `case "version":` becomes:

```go
	case "version":
		var text string
		if text, err = versionText(buildVersion()); err == nil {
			fmt.Print(text)
		}
```

Add `"schema", <LatestVersion>` to the `log.Info("starting equori", ...)` attributes in `serve()`; on a `LatestVersion` error, `serve` returns it.

- [ ] **Step 4: Run** `go test ./cmd/equori/` and `go run ./cmd/equori version`.
Expected: PASS; the command prints three lines, the first `equori (devel)` or the module version.

- [ ] **Step 5: Commit**

```bash
git add cmd/equori/version.go cmd/equori/version_test.go cmd/equori/main.go
git commit -m "feat(platform): print schema version and postgres minimum in equori version" -m "The release smoke test and the Homebrew test read the version line;
an owner comparing a backup with a binary reads the schema line (V3)."
```

---

### Task 3: An empty time zone resolves to the system zone (C1)

**Files:**
- Modify: `internal/platform/config/config.go` (the `time.LoadLocation(getenv("EQUORI_TIMEZONE"))` block)
- Test: `internal/platform/config/config_test.go` (case `"defaults"`)
- Modify: `README.md` (row `EQUORI_TIMEZONE`)

**Interfaces:**
- Produces: `Config.TimeZone == time.Local` when `EQUORI_TIMEZONE` is empty.

- [ ] **Step 1: Change the expectation of case `"defaults"`** in `TestLoad`: `TimeZone: time.UTC` becomes `TimeZone: time.Local`. Add a case:

```go
		{
			name: "explicit time zone",
			env:  map[string]string{"EQUORI_DATABASE_URL": "postgres://x", "EQUORI_TIMEZONE": "America/Sao_Paulo"},
			want: Config{
				DatabaseURL: "postgres://x", HTTPAddr: ":8080", LogLevel: slog.LevelInfo, TimeZone: mustLoad(t, "America/Sao_Paulo"),
				SyncInterval: time.Hour, GeminiURL: "https://generativelanguage.googleapis.com",
			},
		},
```

with the helper `func mustLoad(t *testing.T, name string) *time.Location` calling `time.LoadLocation` and `t.Fatal` on error. If `reflect.DeepEqual` fails on two loads of one zone, compare `got.TimeZone.String()` with `tt.want.TimeZone.String()` and zero both fields before the `DeepEqual`.

- [ ] **Step 2: Run** `go test -run TestLoad ./internal/platform/config/`
Expected: FAIL on `"defaults"`: got `UTC`, want `Local`.

- [ ] **Step 3: Implement:**

```go
	cfg.TimeZone = time.Local
	if name := getenv("EQUORI_TIMEZONE"); name != "" {
		tz, err := time.LoadLocation(name)
		if err != nil {
			return Config{}, fmt.Errorf("EQUORI_TIMEZONE: %w", err)
		}
		cfg.TimeZone = tz
	}
```

Comment on the first line: `// The host's zone: a container without TZ and without zone files resolves to UTC.`

- [ ] **Step 4: Run** `go test ./internal/platform/config/`
Expected: PASS.

- [ ] **Step 5: README.** Row `EQUORI_TIMEZONE`: default column becomes `the host's zone (UTC in the container image)`.

- [ ] **Step 6: Commit**

```bash
git add internal/platform/config README.md
git commit -m "feat(platform): default the time zone to the host's zone" -m "A binary run on the owner's computer took UTC as today when
EQUORI_TIMEZONE was unset, so an expense recorded after 21:00 in
Sao Paulo landed on the next day. The container image has no zone
files and keeps UTC (C1 of the distribution design)."
```

---

### Task 4: `make dist` builds reproducible archives (R2)

**Files:**
- Modify: `Makefile` (new variables, target `dist`, `.PHONY`)
- Modify: `.gitignore` (add `/dist/`)

**Interfaces:**
- Produces: `make dist DIST_VERSION=vX.Y.Z` writes `dist/equori_X.Y.Z_<os>_<arch>.tar.gz` for the four targets and `dist/SHA256SUMS`. Without `DIST_VERSION`, the version is `git describe --tags --exact-match`, or `dev`.

- [ ] **Step 1: Add to `Makefile`** after the `build` target:

```make
# Release archives (R2 of docs/superpowers/specs/2026-10-26-distribution-design.md). The commit
# time stamps every file and gzip stores no name or time, so two builds of one commit are identical.
DIST_TARGETS := linux/amd64 linux/arm64 darwin/amd64 darwin/arm64
DIST_VERSION ?= $(shell git describe --tags --exact-match 2>/dev/null || echo dev)

dist: web-build
	rm -rf dist && mkdir -p dist
	epoch=$$(git log -1 --format=%ct) && \
	for target in $(DIST_TARGETS); do \
		os=$${target%/*} && arch=$${target#*/} && name=equori_$(DIST_VERSION:v%=%)_$${os}_$${arch} && \
		mkdir -p dist/$$name && \
		CGO_ENABLED=0 GOOS=$$os GOARCH=$$arch go build -trimpath -ldflags="-s -w -X main.version=$(DIST_VERSION)" -o dist/$$name/equori ./cmd/equori && \
		cp LICENSE README.md dist/$$name/ && \
		tar --sort=name --mtime=@$$epoch --owner=0 --group=0 --numeric-owner --mode='u+rw,go+r,go-w' -C dist -cf - $$name | gzip -n > dist/$$name.tar.gz && \
		rm -rf dist/$$name || exit 1; \
	done
	cd dist && sha256sum *.tar.gz > SHA256SUMS
```

Add `dist` to `.PHONY`. Add `/dist/` to `.gitignore`.

- [ ] **Step 2: Run it twice and compare**

Run: `make dist DIST_VERSION=v0.0.0-test && cp dist/SHA256SUMS /tmp/claude-sums-1 && make dist DIST_VERSION=v0.0.0-test && diff /tmp/claude-sums-1 dist/SHA256SUMS && echo identical`
Expected: four `.tar.gz` lines in `SHA256SUMS`, and `identical`.

- [ ] **Step 3: Check the content**

Run: `tar -tzf dist/equori_0.0.0-test_linux_amd64.tar.gz && tar -xzf dist/equori_0.0.0-test_linux_amd64.tar.gz -C /tmp && /tmp/equori_0.0.0-test_linux_amd64/equori version | head -1`
Expected: three entries under `equori_0.0.0-test_linux_amd64/` (`LICENSE`, `README.md`, `equori`) and the line `equori v0.0.0-test`.

- [ ] **Step 4: Commit**

```bash
git add Makefile .gitignore
git commit -m "build: add make dist for reproducible release archives" -m "Four targets of the CGO-free binary, packed with the commit time and
no gzip name, plus SHA256SUMS (R2 of the distribution design)."
```

---

### Task 5: `compose.yaml` names a version

**Files:**
- Modify: `compose.yaml` (`services.app.image`)

**Interfaces:**
- Produces: the line `image: ghcr.io/andrelopes-code/equori:${EQUORI_VERSION:-dev}` that Task 6 rewrites into the release asset.

- [ ] **Step 1: Change** `image: ghcr.io/andrelopes-code/equori:latest` to `image: ghcr.io/andrelopes-code/equori:${EQUORI_VERSION:-dev}`. Keep `build: .` on the next line. Add above `image` the comment `# A release attaches this file with the default set to its version (R5 of the distribution design); from a clone, compose builds the dev image.`

- [ ] **Step 2: Check that every compose command still parses**

Run: `docker compose -f compose.yaml -f compose.dev.yaml config --quiet && EQUORI_VERSION=0.1.0 docker compose config | grep 'image: ghcr.io/andrelopes-code/equori:0.1.0' && make db-test-up`
Expected: no error; the grep prints the line; `db-test` is healthy.

- [ ] **Step 3: Commit**

```bash
git add compose.yaml
git commit -m "build: pin the compose image to a version" -m "latest moved under an owner's database on every pull. The release
asset carries its own version as the default (V7)."
```

---

### Task 6: Upgrade test script (R7)

**Files:**
- Create: `scripts/upgrade-test.sh` (mode 0755)
- Modify: `Makefile` (target `upgrade-test`, `.PHONY`)

**Interfaces:**
- Produces: `scripts/upgrade-test.sh PREV_IMAGE NEW_IMAGE PREV_REF`. It exits 0 when every fact of a database seeded by `PREV_IMAGE` survives the start of `NEW_IMAGE`, and non-zero with a diff otherwise. `PREV_REF` is the git ref whose `cmd/demoseed` seeds the previous release. Task 7 calls it.

- [ ] **Step 1: Write `scripts/upgrade-test.sh`**

```bash
#!/usr/bin/env bash
# R7 of docs/superpowers/specs/2026-10-26-distribution-design.md: a database written by the previous
# release keeps every fact when the new release migrates it.
set -euo pipefail

if [[ $# -ne 3 ]]; then
	echo "usage: $0 PREV_IMAGE NEW_IMAGE PREV_REF" >&2
	exit 2
fi
prev_image=$1 new_image=$2 prev_ref=$3
name=equori-upgrade-$$
port=18080
work=$(mktemp -d)
url="postgres://equori:equori@$name-db:5432/equori?sslmode=disable"

cleanup() {
	docker rm -f "$name-db" "$name-app" >/dev/null 2>&1 || true
	docker network rm "$name" >/dev/null 2>&1 || true
	git worktree remove --force "$work/src" >/dev/null 2>&1 || true
	rm -rf "$work"
}
trap cleanup EXIT

wait_healthy() {
	for _ in $(seq 120); do
		curl -fsS "http://127.0.0.1:$port/healthz" >/dev/null 2>&1 && return 0
		sleep 1
	done
	docker logs "$name-app" >&2
	return 1
}

start_app() {
	docker run -d --name "$name-app" --network "$name" -p "127.0.0.1:$port:8080" \
		-e EQUORI_DATABASE_URL="$url" -e EQUORI_INSECURE_COOKIES=true "$1" >/dev/null
	wait_healthy
}

# Row counts of every table owned by a user and the balance of every account. Sessions and the
# outbox change with logins and deliveries, not with the facts.
snapshot() {
	docker exec -i "$name-db" psql -U equori -d equori -At -v ON_ERROR_STOP=1 <<'SQL'
SELECT account_id || ' ' || sum(amount) FROM ledger_posting WHERE NOT voided GROUP BY account_id ORDER BY 1;
SELECT format('SELECT %L || '' '' || count(*) FROM %I', table_name, table_name)
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'user_id'
  AND table_name NOT LIKE 'outbox\_%' AND table_name <> 'identity_session'
ORDER BY table_name \gexec
SQL
}

docker network create "$name" >/dev/null
docker run -d --name "$name-db" --network "$name" -e POSTGRES_USER=equori -e POSTGRES_PASSWORD=equori \
	-e POSTGRES_DB=equori postgres:18-alpine >/dev/null
until docker exec "$name-db" pg_isready -h 127.0.0.1 -U equori -d equori >/dev/null 2>&1; do sleep 1; done

start_app "$prev_image"
printf '%s\n' equori-upgrade-test | docker exec -i "$name-app" /equori user create \
	--email upgrade@equori.test --language pt --region BR
git worktree add --detach "$work/src" "$prev_ref" >/dev/null
(cd "$work/src" && go run ./cmd/demoseed -url "http://127.0.0.1:$port" -email upgrade@equori.test \
	-password equori-upgrade-test -today 2026-10-26)
# The dispatcher of the previous release drains the outbox of the seeding.
sleep 15
snapshot >"$work/before"
docker rm -f "$name-app" >/dev/null

start_app "$new_image"
snapshot >"$work/after"
diff -u "$work/before" "$work/after"
echo "upgrade from $prev_image to $new_image kept $(wc -l <"$work/before") facts"
```

The demo persona is Brazilian (`cmd/demoseed`), so `--language pt --region BR` matches the data it writes; this is test data, not a default of the application.

- [ ] **Step 2: Add the Makefile target**

```make
# R7 locally: the current tree as both releases. UPGRADE_PREV_IMAGE and UPGRADE_PREV_REF name a real predecessor.
UPGRADE_PREV_IMAGE ?= equori:upgrade-test
UPGRADE_PREV_REF ?= HEAD
upgrade-test:
	docker build -t equori:upgrade-test .
	scripts/upgrade-test.sh $(UPGRADE_PREV_IMAGE) equori:upgrade-test $(UPGRADE_PREV_REF)
```

Add `upgrade-test` to `.PHONY`.

- [ ] **Step 3: Run it against the current tree**

Run: `make upgrade-test`
Expected: the last line `upgrade from equori:upgrade-test to equori:upgrade-test kept N facts` with N above 20, exit status 0.

- [ ] **Step 4: Prove that it fails on a lost fact**

Insert the line `sed -i 1d "$work/after"` directly above the `diff -u` line, run `make upgrade-test; echo "exit $?"`, then `git checkout scripts/upgrade-test.sh`.
Expected: a diff with one line prefixed by `-`, then `make: *** [Makefile:...: upgrade-test] Error 1` and `exit 2` (make reports the script's status 1 as its own status 2).

- [ ] **Step 5: Commit**

```bash
git add scripts/upgrade-test.sh Makefile
git commit -m "test(platform): check that an upgrade keeps every fact" -m "The previous release seeds the demo persona through its own API, the
new release migrates the database, and the row counts of user tables
and the account balances must match (R7 of the distribution design)."
```

---

### Task 7: Release workflow (R1 to R4, R7)

**Files:**
- Modify: `.github/workflows/release.yml` (rewrite)

**Interfaces:**
- Consumes: `make check`, `make dist` (Task 4), `equori version` first line (Task 2), `scripts/upgrade-test.sh` (Task 6), `compose.yaml` image line (Task 5).
- Produces: a GitHub release holding the four archives, `SHA256SUMS` and `compose.yaml` pinned to the tag; images `X.Y.Z`, `X.Y`, `latest`; build provenance for archives and images.

- [ ] **Step 1: Write `.github/workflows/release.yml`**

```yaml
name: release

on:
  push:
    tags: ["v*.*.*"]

permissions:
  contents: write
  packages: write
  id-token: write
  attestations: write

jobs:
  # R1: nothing is published from a commit that fails make check.
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-go@v6
        with:
          go-version-file: go.mod
          cache-dependency-path: |
            go.sum
            tools/go.sum
      - uses: actions/setup-node@v7
        with:
          node-version-file: web/.node-version
      - run: corepack enable
      - run: make check

  dist:
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-go@v6
        with:
          go-version-file: go.mod
      - uses: actions/setup-node@v7
        with:
          node-version-file: web/.node-version
      - run: corepack enable
      - run: make dist DIST_VERSION=${{ github.ref_name }}
      # R4: the archive's binary reports the tag.
      - run: |
          tar -xzf dist/equori_*_linux_amd64.tar.gz -C "$RUNNER_TEMP"
          test "$("$RUNNER_TEMP"/equori_*_linux_amd64/equori version | head -1)" = "equori ${{ github.ref_name }}"
      - uses: actions/attest-build-provenance@v4
        with:
          subject-path: dist/*.tar.gz
      - uses: actions/upload-artifact@v7
        with:
          name: dist
          path: dist/

  image:
    needs: check
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.meta.outputs.version }}
    steps:
      - uses: actions/checkout@v5
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable=${{ !contains(github.ref_name, '-') }}
      # R4: the image reports the tag before anything is pushed.
      - uses: docker/build-push-action@v6
        with:
          context: .
          load: true
          tags: equori:smoke
          build-args: VERSION=${{ github.ref_name }}
      - run: test "$(docker run --rm equori:smoke version | head -1)" = "equori ${{ github.ref_name }}"
      - id: push
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          build-args: VERSION=${{ github.ref_name }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
      - uses: actions/attest-build-provenance@v4
        with:
          subject-name: ghcr.io/${{ github.repository }}
          subject-digest: ${{ steps.push.outputs.digest }}
          push-to-registry: true

  # R7: the database of the previous tag migrates under this one with every fact.
  upgrade:
    needs: image
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: actions/setup-go@v6
        with:
          go-version-file: go.mod
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: prev
        run: echo "tag=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || true)" >> "$GITHUB_OUTPUT"
      - if: steps.prev.outputs.tag == ''
        run: echo "no previous tag; the first release has nothing to upgrade from"
      - if: steps.prev.outputs.tag != ''
        run: |
          prev=${{ steps.prev.outputs.tag }}
          scripts/upgrade-test.sh "ghcr.io/${{ github.repository }}:${prev#v}" \
            "ghcr.io/${{ github.repository }}:${{ needs.image.outputs.tag }}" "$prev"

  release:
    needs: [dist, image, upgrade]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/download-artifact@v8
        with:
          name: dist
          path: dist/
      - name: Pin compose.yaml to the release
        run: |
          version=${GITHUB_REF_NAME#v}
          sed -e "s/\${EQUORI_VERSION:-dev}/\${EQUORI_VERSION:-$version}/" -e '/^    build: \.$/d' compose.yaml > dist/compose.yaml
          grep -q "equori:\${EQUORI_VERSION:-$version}" dist/compose.yaml
      - name: GitHub release
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          flags=(--generate-notes --verify-tag)
          if [[ "$GITHUB_REF_NAME" == *-* ]]; then flags+=(--prerelease); fi
          gh release create "$GITHUB_REF_NAME" "${flags[@]}" dist/*.tar.gz dist/SHA256SUMS dist/compose.yaml
```

The image of the previous tag on GHCR carries its version without `v`, the tag `X.Y.Z` of `docker/metadata-action`.

- [ ] **Step 2: Validate the syntax**

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:1.7.7 .github/workflows/release.yml`
Expected: no output, exit status 0. If the image tag does not exist, run `gh api repos/rhysd/actionlint/releases/latest --jq .tag_name` and use that version without `v`.

- [ ] **Step 3: Check the compose rewrite locally**

Run: `GITHUB_REF_NAME=v0.1.0 bash -c 'version=${GITHUB_REF_NAME#v}; sed -e "s/\${EQUORI_VERSION:-dev}/\${EQUORI_VERSION:-$version}/" -e "/^    build: \.$/d" compose.yaml' | docker compose -f - config | grep -E 'image: ghcr.io/andrelopes-code/equori:0.1.0$'`
Expected: the grep prints the image line; `build` is absent from the output.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: gate, smoke-test, attest and upgrade-test every release" -m "make check runs on the tagged commit before anything is published.
The archives and the image report the tag before upload, both carry
build provenance, the database of the previous tag must migrate with
every fact, and the release attaches a compose.yaml pinned to its
version (R1 to R4 and R7 of the distribution design)."
```

---

### Task 8: Decision records and documentation of F1

**Files:**
- Create: `docs/adr/021-distribution.md`
- Modify: `docs/domain/08-non-functional-requirements.md` (N24; new N27)
- Modify: `docs/domain/01-vision.md` (section 1.9, first bullet)
- Modify: `README.md` (section `## Run`)
- Modify: `CLAUDE.md` (Commands table)

- [ ] **Step 1: Write `docs/adr/021-distribution.md`** with the structure of the other ADRs (`- Status: accepted`, `- Date: 2026-10-26`, `## Context`, `## Decision`, `## Consequences`). Content:
  - Context: two sentences. equori shipped as compose only, with `latest`; the owner uses the books from a computer and a phone. Cite the spec path.
  - Decision: one table with rows D1 (forms; F1 delivers compose and archives, F2 to F4 add the rest), V1 to V9 copied from the spec, R1 to R7 copied from the spec. Rules copied verbatim; no paraphrase.
  - Consequences: `latest` stays a moving tag but no document names it; a release that fails `make check` or R7 publishes nothing; the first tag skips R7.

- [ ] **Step 2: Non-functional requirements.** Replace N24 with `| N24 | Container images for linux/amd64 and linux/arm64; archives for linux/amd64, linux/arm64, darwin/amd64 and darwin/arm64 (ADR 021); PostgreSQL 18 or later. |`. Add after N26: `| N27 | A binary refuses a database that holds a migration it does not know (ADR 021, V4). | \`TestMigrateRefusesNewerSchema\` |`. N27 sits in section 8.8; the table there has two columns, so write `N27` as `| N27 | <requirement>; verified by \`TestMigrateRefusesNewerSchema\`. |`.

- [ ] **Step 3: Vision 1.9.** Replace `- Self-hosted: one application container plus PostgreSQL (ADR 001, ADR 002). License MIT.` with `- Self-hosted: one binary plus PostgreSQL, distributed in the forms of ADR 021. License MIT.`

- [ ] **Step 4: README `## Run`.**
  - Replace the first code block with:

```sh
curl -fsSLO https://github.com/andrelopes-code/equori/releases/latest/download/compose.yaml
POSTGRES_PASSWORD=change-me docker compose up -d
```

followed by the sentence `The downloaded compose.yaml names the image of its release; a newer release ships its own.`
  - The first-admin command becomes `docker compose exec app /equori user create --email you@example.com --language <code> --region <country> --admin`; the current command lacks the two required flags (`cmd/equori/user.go`, `userUsage`).
  - Add a paragraph `Archives: each release attaches equori_<version>_<os>_<arch>.tar.gz for Linux and macOS and SHA256SUMS. The binary needs EQUORI_DATABASE_URL pointing to PostgreSQL 18 or later.` and the verification command `gh attestation verify equori_<version>_linux_amd64.tar.gz --repo andrelopes-code/equori`.

- [ ] **Step 5: CLAUDE.md Commands table.** Add rows: `| \`make dist\` | Release archives and \`SHA256SUMS\` in \`dist/\` (ADR 021) |` and `| \`make upgrade-test\` | A database seeded by one image keeps every fact under another (ADR 021, R7); defaults to the current tree as both |`.

- [ ] **Step 6: Commit**

```bash
git add docs/adr/021-distribution.md docs/domain/08-non-functional-requirements.md docs/domain/01-vision.md README.md CLAUDE.md
git commit -m "docs: record the distribution forms and release rules" -m "ADR 021 holds the forms, version rules and release pipeline of the
distribution design; N24 and N27 name the artifacts and the refusal
of a newer schema; the README installs from the release asset."
```

---

### Task 9: Phase gate

- [ ] **Step 1:** Run `make check`. Expected: exit status 0.
- [ ] **Step 2:** Run `make upgrade-test`. Expected: exit status 0.
- [ ] **Step 3:** Update `.claude/progress/current.md` with: plan file, tasks completed 1 to 9, `git rev-parse HEAD`, branch, `git status --short`, test state, next action `start docs/superpowers/plans/2026-10-26-distribution-f2-managed-postgres.md Task 1`.
