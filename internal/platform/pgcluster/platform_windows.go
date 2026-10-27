package pgcluster

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// sun_path holds 108 bytes on Windows, the terminating NUL included.
const socketLimit = 107

// socketFallback refuses: a socket directory outside the data directory would need its own DACL.
func socketFallback(abs string) (string, error) {
	return "", fmt.Errorf("socket path %s is over %d bytes; set EQUORI_DATA_DIR to a shorter directory", filepath.Join(abs, "run", ".s.PGSQL.5432"), socketLimit)
}

// lockFile locks byte 0 of the lock file; the system releases it when the process ends (W-M6).
func lockFile(f *os.File) error {
	err := windows.LockFileEx(windows.Handle(f.Fd()), windows.LOCKFILE_EXCLUSIVE_LOCK|windows.LOCKFILE_FAIL_IMMEDIATELY, 0, 1, 0, &windows.Overlapped{})
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

// privateDir creates path for SYSTEM and the process account, or checks an existing one (W-M4).
func privateDir(path string) error {
	if _, err := createPrivate(path, nil); err != nil {
		return err
	}
	return checkDACL(path)
}

func createPrivate(path string, extra []*windows.SID) (bool, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil { //nolint:gosec // G703: the data directory is the owner's configuration.
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
	sa := &windows.SecurityAttributes{Length: uint32(unsafe.Sizeof(windows.SecurityAttributes{})), SecurityDescriptor: sd}
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
	sd, err := windows.GetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
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
			Trustee:           windows.TRUSTEE{TrusteeForm: windows.TRUSTEE_IS_SID, TrusteeValue: windows.TrusteeValueFromSID(sid)},
		})
	}
	acl, err := windows.ACLFromEntries(entries, old)
	if err != nil {
		return fmt.Errorf("extend the DACL of %s: %w", path, err)
	}
	if err := windows.SetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION, nil, nil, acl, nil); err != nil {
		return fmt.Errorf("write the DACL of %s: %w", path, err)
	}
	return nil
}

// checkDACL accepts allow entries for SYSTEM, Administrators, CREATOR OWNER, service SIDs and
// accounts only; a group such as Users would reach the socket and the cluster (W-M4).
func checkDACL(path string) error {
	sd, err := windows.GetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		return fmt.Errorf("read the DACL of %s: %w", path, err)
	}
	acl, _, err := sd.DACL()
	if err != nil || acl == nil {
		return fmt.Errorf("%s has no DACL; managed mode needs one that grants only SYSTEM and accounts", path)
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
			return fmt.Errorf("%s holds an access entry of type %d; managed mode accepts allow and deny entries only", path, ace.Header.AceType)
		}
		sid := (*windows.SID)(unsafe.Pointer(&ace.SidStart)).String() //nolint:gosec // G103: an ACE holds its SID from SidStart (ACCESS_ALLOWED_ACE layout).
		if !allowedSID(sid) {
			return fmt.Errorf("%s grants access to %s; managed mode accepts SYSTEM, Administrators, service SIDs and accounts only", path, sid)
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

// proc holds the restricted token postgres runs under and the Job Object that ends it with equori.
type proc struct {
	token windows.Token
	job   windows.Handle
}

var procCreateRestrictedToken = windows.NewLazySystemDLL("advapi32.dll").NewProc("CreateRestrictedToken")

// newProc starts postgres as pg_ctl does: without the Administrators and Power Users groups, which
// postgres refuses (W-M7), in its own process group, so a terminal's Ctrl-C reaches equori only.
func newProc(cmd *exec.Cmd) (*proc, error) {
	tok, err := restrictedToken()
	if err != nil {
		return nil, err
	}
	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		_ = tok.Close()
		return nil, fmt.Errorf("create job object: %w", err)
	}
	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{
		BasicLimitInformation: windows.JOBOBJECT_BASIC_LIMIT_INFORMATION{LimitFlags: windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE},
	}
	if _, err := windows.SetInformationJobObject(job, windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)), uint32(unsafe.Sizeof(info))); err != nil { //nolint:gosec // G103: the API takes the structure by address.
		_ = tok.Close()
		_ = windows.CloseHandle(job)
		return nil, fmt.Errorf("configure job object: %w", err)
	}
	cmd.SysProcAttr = &syscall.SysProcAttr{Token: syscall.Token(tok), CreationFlags: windows.CREATE_NEW_PROCESS_GROUP}
	return &proc{token: tok, job: job}, nil
}

func restrictedToken() (windows.Token, error) {
	var tok windows.Token
	if err := windows.OpenProcessToken(windows.CurrentProcess(), windows.TOKEN_ALL_ACCESS, &tok); err != nil {
		return 0, fmt.Errorf("open the process token: %w", err)
	}
	defer func() { _ = tok.Close() }()
	admins, err := windows.CreateWellKnownSid(windows.WinBuiltinAdministratorsSid)
	if err != nil {
		return 0, err
	}
	power, err := windows.CreateWellKnownSid(windows.WinBuiltinPowerUsersSid)
	if err != nil {
		return 0, err
	}
	disable := []windows.SIDAndAttributes{{Sid: admins}, {Sid: power}}
	const disableMaxPrivilege = 0x1
	var restricted windows.Token
	r, _, err := procCreateRestrictedToken.Call(uintptr(tok), disableMaxPrivilege, uintptr(len(disable)),
		uintptr(unsafe.Pointer(&disable[0])), 0, 0, 0, 0, uintptr(unsafe.Pointer(&restricted))) //nolint:gosec // G103: the API takes the arrays by address.
	if r == 0 {
		return 0, fmt.Errorf("create a restricted token: %w", err)
	}
	if err := addUserToDefaultDACL(restricted); err != nil {
		_ = restricted.Close()
		return 0, err
	}
	return restricted, nil
}

// addUserToDefaultDACL mirrors AddUserToTokenDacl of PostgreSQL's src/common/exec.c: with the
// Administrators group disabled, the default DACL of an administrator's token no longer lets
// postgres open the processes it starts (spec S6).
func addUserToDefaultDACL(tok windows.Token) error {
	var n uint32
	_ = windows.GetTokenInformation(tok, windows.TokenDefaultDacl, nil, 0, &n)
	buf := make([]byte, n)
	if err := windows.GetTokenInformation(tok, windows.TokenDefaultDacl, &buf[0], n, &n); err != nil {
		return fmt.Errorf("read the default DACL of the token: %w", err)
	}
	old := (*struct{ DefaultDacl *windows.ACL })(unsafe.Pointer(&buf[0])).DefaultDacl //nolint:gosec // G103: TOKEN_DEFAULT_DACL layout.
	user, err := tok.GetTokenUser()
	if err != nil {
		return fmt.Errorf("read the token account: %w", err)
	}
	acl, err := windows.ACLFromEntries([]windows.EXPLICIT_ACCESS{{
		AccessPermissions: windows.GENERIC_ALL,
		AccessMode:        windows.GRANT_ACCESS,
		Inheritance:       windows.NO_INHERITANCE,
		Trustee:           windows.TRUSTEE{TrusteeForm: windows.TRUSTEE_IS_SID, TrusteeType: windows.TRUSTEE_IS_USER, TrusteeValue: windows.TrusteeValueFromSID(user.User.Sid)},
	}}, old)
	if err != nil {
		return fmt.Errorf("extend the default DACL of the token: %w", err)
	}
	dacl := struct{ DefaultDacl *windows.ACL }{acl}
	if err := windows.SetTokenInformation(tok, windows.TokenDefaultDacl, (*byte)(unsafe.Pointer(&dacl)), uint32(unsafe.Sizeof(dacl))); err != nil { //nolint:gosec // G103: TOKEN_DEFAULT_DACL layout.
		return fmt.Errorf("write the default DACL of the token: %w", err)
	}
	return nil
}

// started puts postgres in the Job Object, so it ends when equori ends (W-M6); its backends,
// started later, inherit the job.
func (p *proc) started(cmd *exec.Cmd) error {
	h, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(cmd.Process.Pid)) //nolint:gosec // G115: Windows PIDs fit in uint32.
	if err != nil {
		return fmt.Errorf("open postgres: %w", err)
	}
	defer func() { _ = windows.CloseHandle(h) }()
	if err := windows.AssignProcessToJobObject(p.job, h); err != nil {
		return fmt.Errorf("assign postgres to the job object: %w", err)
	}
	return nil
}

// stop asks pg_ctl, which signals postgres through its named pipe, for a fast or an immediate
// shutdown; an immediate one that fails ends the whole job.
func (p *proc) stop(c *Cluster, immediate bool) error {
	mode := "fast"
	if immediate {
		mode = "immediate"
	}
	out, err := exec.Command(filepath.Join(c.bin, "pg_ctl"), "stop", "-D", filepath.Join(c.dir, "pg"), "-m", mode, "-w", "-t", "60").CombinedOutput() //nolint:gosec,noctx // G204: the programs directory is the owner's configuration; the stop outlives any request context.
	if err == nil {
		return nil
	}
	if immediate {
		_ = windows.TerminateJobObject(p.job, 1)
		return nil
	}
	select {
	case <-c.done:
		return nil
	default:
	}
	return fmt.Errorf("pg_ctl stop: %w: %s", err, out)
}

func (p *proc) close() {
	_ = p.token.Close()
	_ = windows.CloseHandle(p.job)
}
