// Package db embeds the SQL migrations into the binary.
package db

import "embed"

//go:embed migrations/*.sql
var Migrations embed.FS
