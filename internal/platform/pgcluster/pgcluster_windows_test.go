//go:build cluster

package pgcluster

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/windows"
)

// TestHelperHold starts a cluster and holds it until it is killed; it returns at once in a
// normal run.
func TestHelperHold(t *testing.T) {
	if os.Getenv("EQUORI_TEST_HELPER") != "hold" {
		return
	}

	c, err := Start(t.Context(), os.Getenv("EQUORI_TEST_HOLD_DIR"), testBin(t))
	if err != nil {
		t.Fatal(err)
	}

	fmt.Printf("pid %d\n", c.cmd.Process.Pid)
	time.Sleep(120 * time.Second)
}

// W-M6: the Job Object ends the postmaster when the process that started it dies (spec S13), and
// the next Start runs over the postmaster.pid left behind (S14).
func TestStartEndsTheServerWithItsParent(t *testing.T) {
	dir := t.TempDir()
	helper := exec.CommandContext(t.Context(), os.Args[0], "-test.run=^TestHelperHold$")

	helper.Env = append(os.Environ(), "EQUORI_TEST_HELPER=hold", "EQUORI_TEST_HOLD_DIR="+dir)

	out, err := helper.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}

	if err := helper.Start(); err != nil {
		t.Fatal(err)
	}

	var pid int

	scanner := bufio.NewScanner(out)
	for pid == 0 && scanner.Scan() {
		if rest, ok := strings.CutPrefix(scanner.Text(), "pid "); ok {
			pid, _ = strconv.Atoi(rest)
		}
	}

	if pid == 0 {
		_ = helper.Wait()

		t.Fatal("the helper printed no postmaster PID")
	}

	//nolint:gosec // G115: Windows PIDs fit in uint32.
	h, err := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(pid))
	if err != nil {
		t.Fatal(err)
	}

	defer func() { _ = windows.CloseHandle(h) }()

	if err := helper.Process.Kill(); err != nil {
		t.Fatal(err)
	}

	_ = helper.Wait()

	if ev, err := windows.WaitForSingleObject(h, 5000); err != nil || ev != windows.WAIT_OBJECT_0 {
		t.Fatalf("postmaster %d still runs 5 s after its parent died: %v, %v", pid, ev, err)
	}

	c, err := Start(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatalf("Start after the parent died: %v", err)
	}

	defer func() { _ = c.Stop() }()

	if got := query(t, c, "SELECT 'up'"); got != "up" {
		t.Fatal(got)
	}
}

// PW4.2: a data directory outside ASCII, as under C:\Users\João, starts the cluster: initdb and the
// server check their paths as UTF-8 and read them in the ANSI code page.
func TestStartInAFolderOutsideASCII(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "equori Jo\u00e3o")

	c, err := Start(t.Context(), dir, testBin(t))
	if err != nil {
		t.Fatal(err)
	}

	defer func() { _ = c.Stop() }()

	if got := query(t, c, "SELECT 'up'"); got != "up" {
		t.Fatal(got)
	}

	if _, err := os.Stat(filepath.Join(dir, "pg", "PG_VERSION")); err != nil {
		t.Fatal(err)
	}
}
