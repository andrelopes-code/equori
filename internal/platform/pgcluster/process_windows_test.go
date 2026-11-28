package pgcluster

import (
	"os/exec"
	"testing"

	"golang.org/x/sys/windows"
)

// The tray build of equori has no console: a console program it starts without CREATE_NO_WINDOW
// opens a window of its own, and closing that window ends postgres.
func TestNewProcStartsPostgresWithoutAConsole(t *testing.T) {
	cmd := exec.CommandContext(t.Context(), "postgres")

	p, err := newProc(cmd)
	if err != nil {
		t.Fatalf("newProc: %v", err)
	}

	defer p.close()

	flags := cmd.SysProcAttr.CreationFlags
	if flags&windows.CREATE_NO_WINDOW == 0 {
		t.Fatalf("CreationFlags = %#x, want CREATE_NO_WINDOW", flags)
	}

	if flags&windows.CREATE_NEW_PROCESS_GROUP == 0 {
		t.Fatalf("CreationFlags = %#x, want CREATE_NEW_PROCESS_GROUP", flags)
	}
}
