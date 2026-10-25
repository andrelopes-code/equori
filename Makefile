BIN   := $(CURDIR)/bin
TOOLS := $(BIN)/.tools
WEB_DEPS := web/node_modules/.installed

export EQUORI_DEV_DB_PORT ?= 54329
# Tests create and drop one database per test on the db-test server of compose.dev.yaml, which
# keeps its data in memory without fsync; the backup test runs pg_dump in that service.
export EQUORI_TEST_DB_PORT ?= 54339
export EQUORI_TEST_DB_SERVICE ?= db-test
export EQUORI_TEST_DATABASE_URL ?= postgres://equori:equori@127.0.0.1:$(EQUORI_TEST_DB_PORT)/postgres?sslmode=disable
COMPOSE := docker compose -f compose.yaml -f compose.dev.yaml
# Secrets and personal settings kept outside the repository (secret key, timezone, owner); read
# after dev.env and before .env by the targets that run the app.
LOCAL_ENV ?= $(HOME)/.config/equori/local.env
LOAD_ENV := set -a && . ./dev.env && { [ ! -f "$(LOCAL_ENV)" ] || . "$(LOCAL_ENV)"; } && { [ ! -f .env ] || . ./.env; } && set +a

.PHONY: check static fmt fmt-check lint tidy-check gen gen-check test test-race vuln build dev db-up db-down db-test-up run-dev run-prod hooks tools web-deps web-build web-check web-static web-test web-dev demo demo-user demo-reset

# Everything, the Go tests under -race included: CI runs it on every pull request. The web build
# comes first: the Go tests compile package web, which embeds web/dist. The web tests come last:
# beside the Go tests they starve for CPU and pass their timeouts.
check: static web-build
	$(MAKE) --no-print-directory -j2 test-race web-static
	$(MAKE) --no-print-directory web-test

static: fmt-check tidy-check gen-check lint

fmt: $(TOOLS)
	$(BIN)/golangci-lint fmt

fmt-check: $(TOOLS)
	$(BIN)/golangci-lint fmt --diff

lint: $(TOOLS)
	$(BIN)/golangci-lint run

# Each module's adapter/httpapi holds an oapi-codegen.yaml selecting its tag from api/openapi.yaml.
gen: $(TOOLS) $(WEB_DEPS)
	go run ./internal/platform/money/gen
	$(BIN)/sqlc generate
	for cfg in $$(find internal -name oapi-codegen.yaml); do \
		(cd $$(dirname $$cfg) && $(BIN)/oapi-codegen -config oapi-codegen.yaml $(CURDIR)/api/openapi.yaml) || exit 1; \
	done
	cd web && pnpm exec openapi-typescript ../api/openapi.yaml -o src/api/schema.gen.ts
	for theme in equori equori-glass; do \
		tmp=$$(mktemp -d) && (cd web && pnpm exec slotted-build-theme src/theme/$$theme.theme.ts --out $$tmp) \
			&& cp $$tmp/$$theme.css web/src/theme/$$theme.gen.css && rm -rf $$tmp || exit 1; \
	done

gen-check: gen
	git diff --exit-code -- '*.gen.go' '*.gen.ts' '*.gen.css'
	test -z "$$(git ls-files --others --exclude-standard -- '*.gen.go' '*.gen.ts' '*.gen.css')"

tidy-check:
	go mod tidy -diff
	go -C tools mod tidy -diff

test: db-test-up
	go test -timeout 30m ./...

test-race: db-test-up
	go test -race -timeout 30m ./...

vuln: $(TOOLS)
	$(BIN)/govulncheck ./...

build: web-build
	CGO_ENABLED=0 go build -trimpath -o $(BIN)/equori ./cmd/equori

dev: db-up
	$(LOAD_ENV) && go run ./cmd/equori

# The demo user of the local instance (docs/superpowers/plans/2026-10-24-demo-account.md); both targets need make dev running.
DEMO_EMAIL ?= demo@equori.local
export EQUORI_DEMO_PASSWORD ?= equori-demo-account

demo-user: db-up
	-$(LOAD_ENV) && printf '%s\n' "$(EQUORI_DEMO_PASSWORD)" | go run ./cmd/equori user create --email $(DEMO_EMAIL) --language pt --region BR

# Deletes the demo user and every row it owns (cmd/demoseed/reset.sql); make demo then seeds it again.
demo-reset: db-up
	sed 's/@EMAIL@/$(DEMO_EMAIL)/g' cmd/demoseed/reset.sql | $(COMPOSE) exec -T db psql -v ON_ERROR_STOP=1 -U equori -d equori -f -

demo: demo-user
	go run ./cmd/demoseed -email $(DEMO_EMAIL)
	@# The rebuilds collide with the dispatcher while it still drains the events of the seeding, so they retry.
	$(LOAD_ENV) && for i in 1 2 3 4 5 6 7 8 9 10 11 12; do sleep 15; go run ./cmd/equori portfolio rebuild && go run ./cmd/equori reporting rebuild && exit 0; done; exit 1

# The app and the Vite dev server together; Ctrl-C stops both.
run-dev: $(WEB_DEPS)
	$(MAKE) --no-print-directory -j2 dev web-dev

# The production build on PROD_ADDR beside run-dev: minified web/dist embedded in the binary.
# An empty EQUORI_WEB_DEV_PORT makes the binary serve web/dist instead of proxying to Vite.
PROD_ADDR ?= :8091
run-prod: build db-up
	$(LOAD_ENV) \
		&& EQUORI_WEB_DEV_PORT= EQUORI_HTTP_ADDR=$(PROD_ADDR) $(BIN)/equori

db-up:
	$(COMPOSE) up -d --wait db

db-test-up:
	$(COMPOSE) up -d --wait db-test

db-down:
	$(COMPOSE) down

# lefthook.yml holds the hooks; the unset drops the hooks path of the former .githooks/.
hooks: $(TOOLS)
	git config --unset core.hooksPath || true
	$(BIN)/lefthook install

tools: $(TOOLS)

# Corepack reads packageManager from the working directory, so pnpm runs inside web/.
web-deps: $(WEB_DEPS)

$(WEB_DEPS): web/package.json web/pnpm-lock.yaml
	cd web && pnpm install --frozen-lockfile
	touch $@

# web/dist/.gitkeep keeps the go:embed directive of web/embed.go compiling without a build.
web-build: $(WEB_DEPS)
	find web/dist -mindepth 1 ! -name .gitkeep -delete
	cd web && pnpm build

web-check: web-build web-static web-test

# Typecheck, lint and format; eslint, prettier and tsc keep caches under web/node_modules/.cache.
web-static: $(WEB_DEPS)
	cd web && pnpm typecheck
	cd web && pnpm lint
	cd web && pnpm format:check

web-test: $(WEB_DEPS)
	cd web && pnpm test

web-dev: $(WEB_DEPS)
	cd web && pnpm dev

# Tool versions are pinned in tools/go.mod; rebuilt when tools/go.sum changes.
$(TOOLS): tools/go.mod tools/go.sum
	GOBIN=$(BIN) go -C tools install tool
	touch $@
