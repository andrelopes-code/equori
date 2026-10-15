# ADR 004: RFC 9457 problem details for API errors

- Status: accepted
- Date: 2026-10-14

## Decision

Every error response from `/api/v1` has `Content-Type: application/problem+json` and this body:

```json
{
  "type": "about:blank",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "amount must not be zero",
  "code": "invalid_transaction",
  "request_id": "Q2N7...",
  "errors": [{"field": "amount", "message": "must not be zero"}]
}
```

| Field | Rule |
|---|---|
| `type` | Always `about:blank`; `title` is then the HTTP status text (RFC 9457 §4.2.1). |
| `code` | Stable snake_case identifier. Clients branch on `code`, never on `detail`. Codes are declared in `api/openapi.yaml`. Unmatched `/api/` routes return `not_found`; a wrong method returns `method_not_allowed`; a wrong body media type returns `unsupported_media_type`; oversized bodies return `request_too_large` (ADR 007). |
| `detail` | Human-readable, English. Empty for 5xx: internal errors never reach the client. |
| `request_id` | Same value as the `X-Request-ID` header and the access log entry. |
| `errors` | For requests that violate the contract (400 `invalid_request`), one entry per violation; for domain rule failures (422), the field of the first broken rule (ADR 007, C1). |

Implementation: `internal/platform/problem`. Domain errors are mapped to problems in each module's `adapter/httpapi`; `domain` and `app` never import `problem`.
