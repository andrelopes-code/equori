// Package mcp serves the tool registry to MCP clients over stateless Streamable HTTP (ADR 024).
package mcp

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"slices"
	"time"

	sdkauth "github.com/modelcontextprotocol/go-sdk/auth"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Grant is what a verified token allows: one user's tools, every tool of the set when Write.
type Grant struct {
	TokenID string
	UserID  int64
	Write   bool
}

// Verify checks a token; any error answers 401.
type Verify func(ctx context.Context, token string) (Grant, error)

type Config struct {
	Registry *tool.Registry
	// Names are the tools of the chat set; a read grant reaches only the ReadOnly ones.
	Names        []string
	Instructions string
	Version      string
	Verify       Verify
	Log          *slog.Logger
}

const maxBodyBytes = 1 << 20

// New returns the handler of POST /mcp.
func New(cfg Config) http.Handler {
	read, write := newServer(cfg, false), newServer(cfg, true)
	h := sdk.NewStreamableHTTPHandler(func(r *http.Request) *sdk.Server {
		if g, ok := grantFrom(r.Context()); ok && g.Write {
			return write
		}
		return read
	}, &sdk.StreamableHTTPOptions{
		Stateless: true, MaxRequestBodyBytes: maxBodyBytes, Logger: cfg.Log,
		// Behind a reverse proxy the Host is the public name on a loopback listener; the origin check
		// and the bearer token guard the endpoint instead (ADR 024, design Review Focus 1).
		DisableLocalhostProtection: true,
	})
	// The SDK hands a request's TokenInfo to its handlers; the grant rides in it.
	carry := sdkauth.RequireBearerToken(func(ctx context.Context, _ string, _ *http.Request) (*sdkauth.TokenInfo, error) {
		g, _ := grantFrom(ctx)
		return &sdkauth.TokenInfo{Extra: map[string]any{grantExtra: g}}, nil
	}, &sdkauth.RequireBearerTokenOptions{AllowMissingExpiration: true})
	return authenticate(cfg.Verify, carry(h))
}

const grantExtra = "equori_grant"

func newServer(cfg Config, write bool) *sdk.Server {
	s := sdk.NewServer(&sdk.Implementation{Name: "equori", Version: cfg.Version}, &sdk.ServerOptions{Instructions: cfg.Instructions})
	var listed []string
	for _, name := range cfg.Names {
		t, ok := cfg.Registry.Tool(name)
		if !ok {
			continue
		}
		spec := t.Spec()
		if !write && spec.Effect != tool.ReadOnly {
			continue
		}
		listed = append(listed, name)
		destructive := spec.Effect == tool.Destructive
		s.AddTool(&sdk.Tool{
			Name: spec.Name, Description: spec.Description, InputSchema: t.InputSchema(), OutputSchema: t.OutputSchema(),
			Annotations: &sdk.ToolAnnotations{ReadOnlyHint: spec.Effect == tool.ReadOnly, DestructiveHint: &destructive, IdempotentHint: spec.Idempotent},
		}, callTool(cfg, spec))
	}
	if !write {
		// X14: a read token reaches no write tool, also by calling it without listing it.
		s.AddReceivingMiddleware(func(next sdk.MethodHandler) sdk.MethodHandler {
			return func(ctx context.Context, method string, req sdk.Request) (sdk.Result, error) {
				if call, ok := req.(*sdk.CallToolRequest); ok && method == "tools/call" && !slices.Contains(listed, call.Params.Name) {
					return toolResult(tool.Result{Content: notAllowed, IsError: true}), nil
				}
				return next(ctx, method, req)
			}
		})
	}
	return s
}

var notAllowed = json.RawMessage(`{"code":"tool_not_allowed","detail":"the token's scope does not include this tool"}`)

// callTool runs a call through the registry, which writes without a proposal (X17), and logs it (X19).
func callTool(cfg Config, spec tool.Spec) sdk.ToolHandler {
	return func(ctx context.Context, req *sdk.CallToolRequest) (*sdk.CallToolResult, error) {
		var g Grant
		if info := req.Extra.TokenInfo; info != nil {
			g, _ = info.Extra[grantExtra].(Grant)
		}
		start := time.Now()
		res, err := cfg.Registry.Call(auth.WithUserID(ctx, g.UserID), spec.Name, req.Params.Arguments)
		outcome := "ok"
		switch {
		case err != nil:
			outcome = "canceled"
		case res.IsError:
			var e struct {
				Code string `json:"code"`
			}
			_ = json.Unmarshal(res.Content, &e)
			outcome = e.Code
		}
		cfg.Log.LogAttrs(ctx, slog.LevelInfo, "mcp call", slog.String("token_id", g.TokenID), slog.Int64("user_id", g.UserID),
			slog.String("tool", spec.Name), slog.String("effect", spec.Effect.String()), slog.String("outcome", outcome),
			slog.Duration("duration", time.Since(start)), slog.Int("bytes", len(res.Content)))
		if err != nil {
			return nil, err
		}
		return toolResult(res), nil
	}
}

// toolResult carries the same JSON as structured content and as one text block (X16).
func toolResult(res tool.Result) *sdk.CallToolResult {
	return &sdk.CallToolResult{
		StructuredContent: res.Content,
		Content:           []sdk.Content{&sdk.TextContent{Text: string(res.Content)}},
		IsError:           res.IsError,
	}
}
