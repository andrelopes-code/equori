package main

import (
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/windows"
)

// W-M3: the first command on a missing data directory creates it with the protected DACL, before
// secret.key lands in it.
func TestSetupCreatesAPrivateDataDirectory(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "equori")
	t.Setenv("EQUORI_DATABASE_URL", "")
	t.Setenv("EQUORI_DATA_DIR", dir)
	if _, _, err := setup(); err != nil {
		t.Fatal(err)
	}
	sd, err := windows.GetNamedSecurityInfo(dir, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		t.Fatal(err)
	}
	if got := sd.String(); !strings.HasPrefix(got, "D:P") {
		t.Fatalf("DACL of the data directory = %s, want a protected one", got)
	}
}
