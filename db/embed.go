// Package db embeds the SQL migrations into the binary.
package db

import "embed"

// The all: prefix includes .gitkeep, which keeps the embed valid while no migration exists.
//
//go:embed all:migrations
var Migrations embed.FS
