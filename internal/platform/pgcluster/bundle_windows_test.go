//go:build cluster

package pgcluster

import (
	"debug/pe"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

// windowsDLLs are the libraries of W-P3 that every Windows ships; api-ms-win-crt-* is the UCRT.
var windowsDLLs = []string{"kernel32", "advapi32", "ws2_32", "secur32", "wldap32", "crypt32", "bcrypt", "ole32",
	"oleaut32", "shell32", "user32", "iphlpapi", "pdh", "ntdll", "dbghelp", "netmsg", "msvcrt"}

// W-P3: every library a program or module of the bundle imports is in the bundle or in Windows.
func TestBundleImportsResolve(t *testing.T) {
	bin := testBin(t)
	for _, dir := range []string{bin, filepath.Join(bin, "..", "lib")} {
		entries, err := os.ReadDir(dir)
		if err != nil {
			t.Fatal(err)
		}
		for _, e := range entries {
			name := strings.ToLower(e.Name())
			if !strings.HasSuffix(name, ".exe") && !strings.HasSuffix(name, ".dll") {
				continue
			}
			f, err := pe.Open(filepath.Join(dir, e.Name()))
			if err != nil {
				t.Fatal(err)
			}
			libs, err := f.ImportedLibraries()
			_ = f.Close()
			if err != nil {
				t.Fatal(err)
			}
			for _, lib := range libs {
				l := strings.ToLower(lib)
				if strings.HasPrefix(l, "api-ms-win-crt-") || slices.Contains(windowsDLLs, strings.TrimSuffix(l, ".dll")) {
					continue
				}
				if _, err := os.Stat(filepath.Join(bin, l)); err != nil {
					t.Errorf("%s imports %s, which is neither in %s nor shipped by Windows", e.Name(), lib, bin)
				}
			}
		}
	}
}
