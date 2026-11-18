package server

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/api"
	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/contract"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/spa"
	"github.com/andrelopes-code/equori/internal/platform/tool/mcp"
)

func newHandler(
	pool *pgxpool.Pool,
	cfg Config,
	log *slog.Logger,
	m *modules,
	validator *contract.Validator,
) http.Handler {
	mux := http.NewServeMux()
	registerRoutes(mux, pool, cfg, log, m)

	// /mcp sits outside /api/ and its session gate: a personal access token opens it, and only it
	// (ADR 024).
	root := http.NewServeMux()
	root.Handle("/mcp", mcpHandler(m, log))
	// An MCP client uploads a conversation file with the same token (ADR 024 X20).
	root.Handle("POST /mcp/files", mcp.Identified(mcpGrant(m.identity), m.assistant.FileUpload()))
	root.Handle("/", m.identity.Authorize(
		validator.Middleware(mux),
		func(r *http.Request) (string, bool) {
			return validator.Extension(r, "x-book-role")
		},
	))

	return httpserver.Middleware(root, log,
		slices.Concat(
			m.ledger.BodyLimits(),
			m.ingestion.BodyLimits(),
			m.reporting.BodyLimits(),
			m.marketdata.BodyLimits(),
			m.assistant.BodyLimits(),
		)...)
}

func registerRoutes(
	mux *http.ServeMux,
	pool *pgxpool.Pool,
	cfg Config,
	log *slog.Logger,
	m *modules,
) {
	mux.Handle("GET /healthz", httpserver.Health(pool))

	if cfg.APIDocs {
		registerAPIDocs(mux, api.Contract)
	}

	m.identity.RegisterRoutes(mux)
	m.assistant.RegisterRoutes(mux)
	m.ledger.RegisterRoutes(mux)
	m.reporting.RegisterRoutes(mux)
	m.ingestion.RegisterRoutes(mux)
	m.instance.RegisterRoutes(mux)
	m.classification.RegisterRoutes(mux)
	m.capture.RegisterRoutes(mux)
	m.planning.RegisterRoutes(mux)
	m.portfolio.RegisterRoutes(mux)
	m.marketdata.RegisterRoutes(mux, log)
	mux.Handle("/api/", httpserver.NotFound())
	// Method-less: "GET /" overlaps "/api/" without either being more specific, and ServeMux
	// panics.
	if cfg.WebDevPort != 0 {
		mux.Handle("/", spa.DevRedirect(cfg.WebDevPort))
	} else {
		mux.Handle("/", spa.Handler(cfg.Web))
	}
}

func mcpHandler(m *modules, log *slog.Logger) http.Handler {
	return mcp.New(mcp.Config{
		Registry:     m.tools,
		Names:        m.chatNames,
		Instructions: assistant.Instructions(),
		Prompts:      mcpPrompts(),
		Version:      m.version,
		Log:          log,
		Verify:       mcpGrant(m.identity),
	})
}

func mcpGrant(identityModule *identity.Module) func(context.Context, string) (mcp.Grant, error) {
	return func(ctx context.Context, token string) (mcp.Grant, error) {
		g, err := identityModule.VerifyAccessToken(ctx, token)
		if errors.Is(err, identity.ErrInvalidAccessToken) {
			return mcp.Grant{}, mcp.ErrInvalidToken
		}

		if err != nil {
			return mcp.Grant{}, err
		}

		loc, err := identityModule.Location(ctx, g.BooksID)
		if err != nil {
			return mcp.Grant{}, err
		}

		return mcp.Grant{
			TokenID:  g.TokenID.String(),
			MemberID: g.MemberID,
			BooksID:  g.BooksID,
			Role:     g.Role,
			Write:    g.Scope == "write" && g.Role.Allows(auth.RoleWrite),
			Location: loc,
		}, nil
	}
}
