## Change

<!-- What changes and why. Link the issue, ADR, spec or scenario (S<n>) it implements. -->

## Checklist

- [ ] `make check` passes.
- [ ] A test covers each acceptance criterion; a bug fix starts with a test that reproduces it.
- [ ] Schema changes come as a new goose migration.
- [ ] A new operation in `api/openapi.yaml` has an entry in `internal/server/tool_exposure_test.go`.
- [ ] Region-dependent values live in their region's implementation (`docs/contributing/regions.md`).
