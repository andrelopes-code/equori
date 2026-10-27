package pgcluster

import (
	"path/filepath"
	"strings"
	"testing"
	"unsafe"

	"golang.org/x/sys/windows"
)

func tokenUser(t *testing.T) string {
	t.Helper()
	u, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		t.Fatal(err)
	}
	return u.User.Sid.String()
}

func daclOf(t *testing.T, path string) string {
	t.Helper()
	sd, err := windows.GetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		t.Fatal(err)
	}
	return sd.String()
}

func mkdirSDDL(t *testing.T, path, sddl string) {
	t.Helper()
	sd, err := windows.SecurityDescriptorFromString(sddl)
	if err != nil {
		t.Fatal(err)
	}
	sa := &windows.SecurityAttributes{Length: uint32(unsafe.Sizeof(windows.SecurityAttributes{})), SecurityDescriptor: sd}
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := windows.CreateDirectory(p, sa); err != nil {
		t.Fatal(err)
	}
}

// W-M3: a created data directory is protected and grants SYSTEM and the process account only.
func TestPrepareDataDirCreates(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "equori")
	if err := PrepareDataDir(path); err != nil {
		t.Fatal(err)
	}
	// String renders well-known accounts by alias (LA for the built-in Administrator of the runner).
	sd, err := windows.SecurityDescriptorFromString("D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;" + tokenUser(t) + ")")
	if err != nil {
		t.Fatal(err)
	}
	if got, want := daclOf(t, path), sd.String(); got != want {
		t.Fatalf("DACL = %s, want %s", got, want)
	}
}

// W-M4: a directory that grants a group is refused, and the message names the SID.
func TestPrivateDirRefusesUsersGroup(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "run")
	mkdirSDDL(t, path, "D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BU)")
	err := privateDir(path)
	if err == nil || !strings.Contains(err.Error(), "S-1-5-32-545") {
		t.Fatalf("privateDir of a directory granting Users = %v, want an error naming S-1-5-32-545", err)
	}
}

// W-M4: entries inherited from a profile directory name accounts, SYSTEM and Administrators only.
func TestPrivateDirAcceptsAccountSID(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "run")
	mkdirSDDL(t, path, "D:(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;FA;;;"+tokenUser(t)+")")
	if err := privateDir(path); err != nil {
		t.Fatal(err)
	}
}

// W-S2: a service account gains an inheritable full-control entry on the data directory, both on
// creation and on an existing directory. TrustedInstaller is a service SID every Windows holds.
func TestPrepareDataDirAddsAccounts(t *testing.T) {
	t.Parallel()
	const account = `NT SERVICE\TrustedInstaller`
	sid, _, _, err := windows.LookupSID("", account)
	if err != nil {
		t.Fatal(err)
	}
	want := "(A;OICI;FA;;;" + sid.String() + ")"
	created := filepath.Join(t.TempDir(), "equori")
	if err := PrepareDataDir(created, account); err != nil {
		t.Fatal(err)
	}
	if got := daclOf(t, created); !strings.Contains(got, want) {
		t.Fatalf("DACL of a created directory = %s, want %s", got, want)
	}
	existing := filepath.Join(t.TempDir(), "equori")
	if err := PrepareDataDir(existing); err != nil {
		t.Fatal(err)
	}
	if err := PrepareDataDir(existing, account); err != nil {
		t.Fatal(err)
	}
	if got := daclOf(t, existing); !strings.Contains(got, want) {
		t.Fatalf("DACL of an existing directory = %s, want %s", got, want)
	}
}

// W-M3, W-S2: the socket directory inherits the data directory's entries, so the account that
// installed the service reaches the service's socket.
func TestPrivateDirInheritsTheDataDirectory(t *testing.T) {
	t.Parallel()
	const account = `NT SERVICE\TrustedInstaller`
	sid, _, _, err := windows.LookupSID("", account)
	if err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(t.TempDir(), "equori")
	if err := PrepareDataDir(dir, account); err != nil {
		t.Fatal(err)
	}
	run := filepath.Join(dir, "run")
	if err := privateDir(run); err != nil {
		t.Fatal(err)
	}
	if got, want := daclOf(t, run), "(A;OICIID;FA;;;"+sid.String()+")"; !strings.Contains(got, want) {
		t.Fatalf("DACL of run = %s, want the inherited entry %s", got, want)
	}
}
