# syntax=docker/dockerfile:1

# The web output is architecture-independent, so this stage also runs on the host platform.
FROM --platform=$BUILDPLATFORM node:26.12.1-slim AS web
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /src/web
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

# The build stage runs on the host platform and cross-compiles, so multi-arch builds need no emulation.
FROM --platform=$BUILDPLATFORM golang:1.27 AS build
ARG TARGETOS TARGETARCH
ARG VERSION=dev
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
COPY --from=web /src/web/dist ./web/dist
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" -o /out/equori ./cmd/equori

# Application and PostgreSQL in one container (ADR 022, M10): equori runs the server of the base
# image as its child. Built with --target standalone; the default target stays the application alone.
FROM postgres:18 AS standalone
COPY --from=build /out/equori /usr/local/bin/equori
ENV EQUORI_DATA_DIR=/data EQUORI_POSTGRES_BIN=/usr/lib/postgresql/18/bin
RUN mkdir -p /data && chown postgres:postgres /data
USER postgres
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD ["equori", "healthcheck"]
ENTRYPOINT ["equori"]
CMD ["serve"]

FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=build /out/equori /equori
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD ["/equori", "healthcheck"]
ENTRYPOINT ["/equori"]
