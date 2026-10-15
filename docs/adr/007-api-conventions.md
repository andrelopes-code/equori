# ADR 007: API conventions and contract validation

- Status: accepted
- Date: 2026-10-16

## Context

A probe of the API before phase P4 found that the generated handlers accept unknown JSON members, bodies of any media type and trailing data; that malformed requests return 400 without naming the field; that a request with several invalid fields reports one; that a wrong method returns 404; that action endpoints mix verbs and nouns with 200, 201 and 204; that statement amounts are integers without currency; and that only `/transactions` is paginated (N23). `api/openapi.yaml` describes the contract but nothing enforces it.

## Decision

| ID | Rule |
|---|---|
| C1 | `internal/platform/contract` validates every `/api/v1` request against `api/openapi.yaml` before the module handler. A violation returns 400 `invalid_request` with one `errors` entry per violation: body members as `postings[0].amount`, parameters by name (`limit`, `id`). A request that conforms but breaks a domain rule returns 422 (`validation_failed` or a specific code) with the field of the first broken rule. |
| C2 | Request schemas declare `additionalProperties: false`: an unknown member is a violation. |
| C3 | Field-shape rules are declared in the contract: required members, `minLength`, `maxLength`, `enum`, `pattern`, `minimum`, `maximum`, `maxItems`. The domain checks them again; the contract reports all of them in one response. |
| C4 | A request body has the media type its operation declares, otherwise 415 `unsupported_media_type`. A JSON body is exactly one value. Multipart bodies are checked for media type only and never buffered by the validator. |
| C5 | A path that exists with another method returns 405 `method_not_allowed` with an `Allow` header. |
| C6 | A sub-collection noun creates a record (`/payments`, `/refunds`, `/disputes`, `/financing`, `/cancellation`, `/anticipation`, `/balance-assertions`, `/attachments`) and returns 201 with the record and, when the record has a GET endpoint, a `Location` header. A state transition without a new record is `POST /<resource>/{id}/<verb>` (`void`, `close`, `unlock`, `resolve`, `reconcile`) and returns 200 with the updated resource. |
| C7 | Every monetary value in a response is a `Money` object. |
| C8 | Lists that grow with use paginate by cursor (ADR 005, section 4): accounts, institutions, payees, tags, statements, balance assertions, attachments, transactions. Lists bounded by one parent record or by a requested range return every item without a cursor: holidays of a year, balance series, transaction versions, cards, credit limits, billing cycle rules. |
| C9 | Every response carries `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`. `/api/` responses also carry `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` and `Cache-Control: no-store`. |

Dependency: `github.com/getkin/kin-openapi` (`openapi3`, `openapi3filter`, `routers`) loads the document and validates requests. It is the library oapi-codegen already uses to read the same document.

## Consequences

- The contract and the server cannot drift for requests: a field the document omits is rejected.
- Field errors arrive in one response, which a form can display at once.
- The validator parses each JSON body once more before the handler; bodies are at most 1 MiB except uploads, which it does not parse.
- These rules change status codes and paths of phases P1–P3; no client existed when they changed.
