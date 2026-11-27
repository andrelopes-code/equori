package pgcluster

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

// sun_path holds 108 bytes on Windows, the terminating NUL included.
const socketLimit = 107

// socketFallback refuses: a socket directory outside the data directory would need its own DACL.
func socketFallback(abs string) (string, error) {
	return "", fmt.Errorf(
		"socket path %s is over %d bytes; set EQUORI_DATA_DIR to a shorter directory",
		filepath.Join(abs, "run", ".s.PGSQL.5432"),
		socketLimit,
	)
}

// lockFile locks byte 0 of the lock file; the system releases it when the process ends (W-M6).
func lockFile(f *os.File) error {
	err := windows.LockFileEx(
		windows.Handle(f.Fd()),
		windows.LOCKFILE_EXCLUSIVE_LOCK|windows.LOCKFILE_FAIL_IMMEDIATELY,
		0,
		1,
		0,
		&windows.Overlapped{},
	)
	if errors.Is(err, windows.ERROR_LOCK_VIOLATION) {
		return ErrBusy
	}

	if err != nil {
		return fmt.Errorf("lock data directory: %w", err)
	}

	return nil
}

// prepareDataDir creates dir with the DACL of W-M3 for SYSTEM, the process account and accounts,
// or adds accounts to an existing dir; either way the result passes the check of privateDir.
func prepareDataDir(dir string, accounts []string) error {
	sids := make([]*windows.SID, 0, len(accounts))
	for _, name := range accounts {
		sid, _, _, err := windows.LookupSID("", name)
		if err != nil {
			return fmt.Errorf("look up account %s: %w", name, err)
		}

		sids = append(sids, sid)
	}

	created, err := createPrivate(dir, sids)
	if err != nil {
		return err
	}

	if !created && len(sids) > 0 {
		if err := grant(dir, sids); err != nil {
			return err
		}
	}

	return checkDACL(dir)
}

// nativePath is path in bytes postgres.exe keeps intact: it reads its paths in the ANSI code page,
// its server checks them as UTF-8 and Go dials the socket in UTF-8, so a path outside ASCII takes
// its short name, which NTFS writes in ASCII (PW4.2).
func nativePath(path string) (string, error) {
	if isASCII(path) {
		return path, nil
	}

	long, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return "", fmt.Errorf("encode %s: %w", path, err)
	}

	var buf [windows.MAX_PATH]uint16

	n, err := windows.GetShortPathName(long, &buf[0], windows.MAX_PATH)
	if err != nil {
		return "", fmt.Errorf("read the short name of %s: %w", path, err)
	}

	// A short name longer than the buffer returns its size instead.
	if n > windows.MAX_PATH {
		return "", fmt.Errorf("short name of %s is over %d characters", path, windows.MAX_PATH)
	}

	short := windows.UTF16ToString(buf[:n])
	if !isASCII(short) {
		return "", fmt.Errorf(
			"path %s holds letters outside ASCII and its volume keeps no short names; "+
				"set EQUORI_DATA_DIR to a directory named in ASCII",
			path,
		)
	}

	return short, nil
}

func isASCII(s string) bool {
	for i := range len(s) {
		if s[i] >= 0x80 {
			return false
		}
	}

	return true
}

// privateDir creates the socket directory inside the data directory, whose entries it inherits,
// so every account the data directory grants reaches the socket; then it checks it (W-M4).
func privateDir(path string) error {
	//nolint:gosec // G703: the data directory is the owner's configuration.
	if err := os.MkdirAll(path, 0o700); err != nil {
		return fmt.Errorf("create %s: %w", path, err)
	}

	return checkDACL(path)
}

func createPrivate(path string, extra []*windows.SID) (bool, error) {
	//nolint:gosec // G703: the data directory is the owner's configuration.
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return false, fmt.Errorf("create %s: %w", filepath.Dir(path), err)
	}

	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		return false, fmt.Errorf("read the process account: %w", err)
	}

	sddl := "D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;" + user.User.Sid.String() + ")"
	for _, sid := range extra {
		sddl += "(A;OICI;FA;;;" + sid.String() + ")"
	}

	sd, err := windows.SecurityDescriptorFromString(sddl)
	if err != nil {
		return false, fmt.Errorf("security descriptor %s: %w", sddl, err)
	}

	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return false, err
	}

	sa := &windows.SecurityAttributes{
		Length:             uint32(unsafe.Sizeof(windows.SecurityAttributes{})),
		SecurityDescriptor: sd,
	}

	err = windows.CreateDirectory(p, sa)
	if errors.Is(err, windows.ERROR_ALREADY_EXISTS) {
		return false, nil
	}

	if err != nil {
		return false, fmt.Errorf("create %s: %w", path, err)
	}

	return true, nil
}

func grant(path string, sids []*windows.SID) error {
	sd, err := windows.GetNamedSecurityInfo(
		path,
		windows.SE_FILE_OBJECT,
		windows.DACL_SECURITY_INFORMATION,
	)
	if err != nil {
		return fmt.Errorf("read the DACL of %s: %w", path, err)
	}

	old, _, err := sd.DACL()
	if err != nil {
		return fmt.Errorf("read the DACL of %s: %w", path, err)
	}

	entries := make([]windows.EXPLICIT_ACCESS, 0, len(sids))
	for _, sid := range sids {
		entries = append(entries, windows.EXPLICIT_ACCESS{
			AccessPermissions: windows.STANDARD_RIGHTS_ALL | 0x1ff, // FILE_ALL_ACCESS
			AccessMode:        windows.GRANT_ACCESS,
			Inheritance:       windows.SUB_CONTAINERS_AND_OBJECTS_INHERIT,
			Trustee: windows.TRUSTEE{
				TrusteeForm:  windows.TRUSTEE_IS_SID,
				TrusteeValue: windows.TrusteeValueFromSID(sid),
			},
		})
	}

	acl, err := windows.ACLFromEntries(entries, old)
	if err != nil {
		return fmt.Errorf("extend the DACL of %s: %w", path, err)
	}

	if err := windows.SetNamedSecurityInfo(
		path,
		windows.SE_FILE_OBJECT,
		windows.DACL_SECURITY_INFORMATION,
		nil,
		nil,
		acl,
		nil,
	); err != nil {
		return fmt.Errorf("write the DACL of %s: %w", path, err)
	}

	return nil
}

// checkDACL accepts allow entries for SYSTEM, Administrators, CREATOR OWNER, service SIDs and
// accounts only; a group such as Users would reach the socket and the cluster (W-M4).
func checkDACL(path string) error {
	sd, err := windows.GetNamedSecurityInfo(
		path,
		windows.SE_FILE_OBJECT,
		windows.DACL_SECURITY_INFORMATION,
	)
	if err != nil {
		return fmt.Errorf("read the DACL of %s: %w", path, err)
	}

	acl, _, err := sd.DACL()
	if err != nil || acl == nil {
		return fmt.Errorf(
			"%s has no DACL; managed mode needs one that grants only SYSTEM and accounts",
			path,
		)
	}

	for i := range uint32(acl.AceCount) {
		var ace *windows.ACCESS_ALLOWED_ACE
		if err := windows.GetAce(acl, i, &ace); err != nil {
			return fmt.Errorf("read the DACL of %s: %w", path, err)
		}

		switch ace.Header.AceType {
		case windows.ACCESS_DENIED_ACE_TYPE:
			continue
		case windows.ACCESS_ALLOWED_ACE_TYPE:
		default:
			return fmt.Errorf(
				"%s holds an access entry of type %d; managed mode accepts allow and deny entries only",
				path,
				ace.Header.AceType,
			)
		}

		//nolint:gosec // G103: an ACE holds its SID from SidStart (ACCESS_ALLOWED_ACE layout).
		sid := (*windows.SID)(unsafe.Pointer(&ace.SidStart)).String()
		if !allowedSID(sid) {
			return fmt.Errorf(
				"%s grants access to %s; managed mode accepts SYSTEM, Administrators, service SIDs and accounts only",
				path,
				sid,
			)
		}
	}

	return nil
}

func allowedSID(sid string) bool {
	switch sid {
	case "S-1-5-18", "S-1-5-32-544", "S-1-3-0":
		return true
	}

	return strings.HasPrefix(sid, "S-1-5-80-") || strings.HasPrefix(sid, "S-1-5-21-")
}

// checkPrivileges accepts an elevated token: postgres runs under a restricted one (W-M7).
func checkPrivileges() error { return nil }
