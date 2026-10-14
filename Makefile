BIN   := $(CURDIR)/bin
TOOLS := $(BIN)/.tools

export EQUORI_DEV_DB_PORT ?= 54329
DEV_DATABASE_URL := postgres://equori:equori@127.0.0.1:$(EQUORI_DEV_DB_PORT)/equori?sslmode=disable
# Tests create and drop one database per test on this server.
export EQUORI_TEST_DATABASE_URL ?= postgres://equori:equori@127.0.0.1:$(EQUORI_DEV_DB_PORT)/postgres?sslmode=disable

.PHONY: check fmt fmt-check lint tidy-check test vuln build dev db-up db-down hooks

check: fmt-check tidy-check lint test

fmt: $(TOOLS)
	$(BIN)/golangci-lint fmt

fmt-check: $(TOOLS)
	$(BIN)/golangci-lint fmt --diff

lint: $(TOOLS)
	$(BIN)/golangci-lint run

tidy-check:
	go mod tidy -diff
	go -C tools mod tidy -diff

test: db-up
	go test -race ./...

vuln: $(TOOLS)
	$(BIN)/govulncheck ./...

build:
	CGO_ENABLED=0 go build -trimpath -o $(BIN)/equori ./cmd/equori

dev: db-up
	EQUORI_DATABASE_URL=$(DEV_DATABASE_URL) go run ./cmd/equori

db-up:
	docker compose -f compose.yaml -f compose.dev.yaml up -d --wait db

db-down:
	docker compose -f compose.yaml -f compose.dev.yaml down

hooks:
	git config core.hooksPath .githooks

# Tool versions are pinned in tools/go.mod; rebuilt when tools/go.sum changes.
$(TOOLS): tools/go.mod tools/go.sum
	GOBIN=$(BIN) go -C tools install tool
	touch $@
