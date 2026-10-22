# ADR 017: Dependency golang.org/x/text

- Status: accepted
- Date: 2026-10-22

## Context

File import decodes CSV files in the character set of the issuing institution, and text folding compares words in any script (`docs/superpowers/specs/2026-10-22-regional-neutrality-design.md`, sections 4.1 and 5.12). The standard library has neither legacy character set decoders nor Unicode normalization.

## Decision

The module depends on `golang.org/x/text` at version `v0.43.0`, maintained by the Go project. It is already in `go.mod` as an indirect requirement; the first import promotes it to a direct requirement.

| Package | Use |
|---|---|
| `unicode/norm` | Decomposition of letters for text folding |
| `encoding` | Decoder interface and lookup |
| `encoding/charmap` | Single-byte character sets (`windows-1252`, ISO 8859) |
| `encoding/japanese` | Shift JIS, EUC-JP, ISO-2022-JP |
| `encoding/simplifiedchinese` | GBK, GB18030 |
| `encoding/korean` | EUC-KR |
| `encoding/traditionalchinese` | Big5 |

## Consequences

- `govulncheck` (`make vuln`) covers the dependency.
- Only `internal/platform` packages import it; modules receive decoded text.

## Revisit criterion

A standard library release that includes these decoders and normalization.
