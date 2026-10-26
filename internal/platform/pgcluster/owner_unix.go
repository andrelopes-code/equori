//go:build unix

package pgcluster

import (
	"os"
	"syscall"
)

// ownedByMe reports whether the current user owns path; the fallback socket directory sits in a
// shared temporary directory where another user could have created it first.
func ownedByMe(info os.FileInfo) bool {
	st, ok := info.Sys().(*syscall.Stat_t)
	return ok && int(st.Uid) == os.Getuid()
}
