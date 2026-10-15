// Package api embeds the HTTP contract that the server validates requests against (ADR 007).
package api

import _ "embed"

//go:embed openapi.yaml
var Contract []byte
