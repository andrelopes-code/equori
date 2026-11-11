# ADR 034: Explicit routes and hand-written handlers

- Status: accepted
- Date: 2026-11-11
- Amends: ADR 007 (the generated strict server) and the `httpapi` row of ADR 033

## Decision

Each module registers its routes in one hand-written list. A handler is a method of the module's `Server` that reads the request, calls the use case and returns the result. `oapi-codegen` generates only the models (`generate: models: true`): request, response and parameter types. It no longer generates the router, the strict server or the response visitors.

```go
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST "+BaseURL+"/capture/preview",
		httpserver.Handle(s.errs, http.StatusOK, s.previewCapture))
}
```

The reader of an endpoint follows three hand-written hops: the route in `httpapi/server.go`, the handler in `httpapi/<topic>.go`, the use case in `app/<topic>.go`.

## Rules

| Rule | Enforcement |
|---|---|
| The contract in `internal/<module>/openapi.yaml` stays the source of the types and of the request validation (ADR 007) | `make gen`; the contract validator of `internal/server` |
| Every operation of a module's tag has a registered route with its method and path | `routetest.Check` in a test of the module's `httpapi` |
| A handler reads the body through `httpserver.Handle` and its variants; it reads path and query values through the helpers of `internal/platform/httpserver` | review |
| Errors keep their path: `ErrorWriter.WriteRequestError` for decoding, `ErrorWriter.Write` for the use case | `internal/platform/httpserver` tests |

## Helpers

`internal/platform/httpserver` holds `Handle` (one signature, `None` for no body or 204), `HandleCreated` and `WriteCreated` (201 with Location), `Query`, `PathUUID` and `PathInt64` (a malformed value answers 400 through `BadRequestError`), and `routetest.Check`.

## Migration

All eleven modules moved in their own commits with equal test counts plus one route test each. Operations that set a header or a cookie, stream, answer 202 without a body or read multipart are plain `func(w, r)` handlers registered in `Register`. Generated Go fell from 67163 to 31431 lines.
