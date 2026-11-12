// Command gen writes api/openapi.yaml from api/base.yaml, api/shared.yaml and the openapi.yaml of each module.
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
)

const (
	basePath    = "api/base.yaml"
	sharedPath  = "api/shared.yaml"
	outputPath  = "api/openapi.yaml"
	modulesGlob = "internal/*/openapi.yaml"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	base, err := os.ReadFile(basePath)
	if err != nil {
		return fmt.Errorf("read base: %w", err)
	}

	sources, err := fragmentPaths()
	if err != nil {
		return err
	}

	fragments := make([]string, 0, len(sources))

	for _, path := range sources {
		//nolint:gosec // G304: the path comes from the generator's own fragment list
		text, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read fragment: %w", err)
		}

		fragments = append(fragments, string(text))
	}

	out, err := bundle(string(base), fragments)
	if err != nil {
		return err
	}

	//nolint:gosec // G306: the bundle is a public source file, committed to the repository
	if err := os.WriteFile(outputPath, []byte(out), 0o644); err != nil {
		return fmt.Errorf("write bundle: %w", err)
	}

	return nil
}

// fragmentPaths lists the shared fragment first, then the module fragments in name order.
func fragmentPaths() ([]string, error) {
	modules, err := filepath.Glob(modulesGlob)
	if err != nil {
		return nil, fmt.Errorf("list module fragments: %w", err)
	}

	sort.Strings(modules)

	return append([]string{sharedPath}, modules...), nil
}
