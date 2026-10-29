// Package web embeds the built single-page application (ADR 028).
package web

import (
	"embed"
	"io/fs"
)

// dist/.gitkeep is committed so the directive compiles before the first Vite build.
//
//go:embed all:dist
var files embed.FS

// Dist returns the contents of web/dist.
func Dist() fs.FS {
	dist, err := fs.Sub(files, "dist")
	if err != nil {
		// fs.Sub fails only on an invalid directory name; "dist" is a constant valid one.
		panic(err)
	}
	return dist
}

//go:embed src/navigation/navigation-map.json
var navigationMap []byte

// NavigationMap returns the screens the assistant links to (spec 9).
func NavigationMap() []byte { return navigationMap }
