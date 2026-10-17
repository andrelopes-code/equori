BIN   := $(CURDIR)/bin
TOOLS := $(BIN)/.tools
WEB_DEPS := web/node_modules/.installed

export EQUORI_DEV_DB_PORT ?= 54329
# Tests create and drop one database per test on this server.
export EQUORI_TEST_DATABASE_URL ?= postgres://equori:equori@127.0.0.1:$(EQUORI_DEV_DB_PORT)/postgres?sslmode=disable

.PHONY: check fmt fmt-check lint tidy-check gen gen-check test vuln build dev db-up db-down hooks tools web-deps web-build web-check web-dev

check: fmt-check tidy-check gen-check lint web-check test

fmt: $(TOOLS)
	$(BIN)/golangci-lint fmt

fmt-check: $(TOOLS)
	$(BIN)/golangci-lint fmt --diff

lint: $(TOOLS)
	$(BIN)/golangci-lint run

# Each module's adapter/httpapi holds an oapi-codegen.yaml selecting its tag from api/openapi.yaml.
gen: $(TOOLS) $(WEB_DEPS)
	$(BIN)/sqlc generate
	for cfg in $$(find internal -name oapi-codegen.yaml); do \
		(cd $$(dirname $$cfg) && $(BIN)/oapi-codegen -config oapi-codegen.yaml $(CURDIR)/api/openapi.yaml) || exit 1; \
	done
	cd web && pnpm exec openapi-typescript ../api/openapi.yaml -o src/api/schema.gen.ts
	tmp=$$(mktemp -d) && (cd web && pnpm exec slotted-build-theme src/theme/equori.theme.ts --out $$tmp) \
		&& cp $$tmp/equori.css web/src/theme/equori.gen.css && rm -rf $$tmp

gen-check: gen
	git diff --exit-code -- '*.gen.go' '*.gen.ts' '*.gen.css'
	test -z "$$(git ls-files --others --exclude-standard -- '*.gen.go' '*.gen.ts' '*.gen.css')"

tidy-check:
	go mod tidy -diff
	go -C tools mod tidy -diff

test: db-up
	go test -race ./...

vuln: $(TOOLS)
	$(BIN)/govulncheck ./...

build: web-build
	CGO_ENABLED=0 go build -trimpath -o $(BIN)/equori ./cmd/equori

dev: db-up
	set -a && . ./dev.env && { [ ! -f .env ] || . ./.env; } && set +a && go run ./cmd/equori

db-up:
	docker compose -f compose.yaml -f compose.dev.yaml up -d --wait db

db-down:
	docker compose -f compose.yaml -f compose.dev.yaml down

hooks:
	git config core.hooksPath .githooks

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

web-check: web-build
	cd web && pnpm typecheck
	cd web && pnpm lint
	cd web && pnpm format:check
	cd web && pnpm test

web-dev: $(WEB_DEPS)
	cd web && pnpm dev

# Tool versions are pinned in tools/go.mod; rebuilt when tools/go.sum changes.
$(TOOLS): tools/go.mod tools/go.sum
	GOBIN=$(BIN) go -C tools install tool
	touch $@
