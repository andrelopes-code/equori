# spreadsheet

Stores the spreadsheets of a book (ADR 038; `docs/specs/2026-11-23-spreadsheets-design.md`). It is the only entry point to the module for the rest of the application.

| | |
|---|---|
| OpenAPI tag | `spreadsheet`: 7 operations in `openapi.yaml` |
| Tables | `spreadsheet_document`, created in `db/migrations/00142_spreadsheet_document.sql` |
| Public API | `spreadsheet.go` (Module, New, RegisterRoutes, BodyLimits) |
| Layers (hand-written files) | `domain/` (1), `app/` (2), `httpapi/` (2), `postgres/` (1) |
| Ports | `app/service.go` (Repository) |
| Queries | `postgres/queries/` (1 file) |
| Tests | black-box tests in this directory (`*_test.go`: 2); package tests beside each layer |

The content of a document is the snapshot the web editor writes. The module stores it as `jsonb` and never reads it.

Where each file of an endpoint lives: `docs/contributing/map.md`.
