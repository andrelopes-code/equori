//go:build windows

package backup

import "testing"

// W-B1: on Windows a file has no mode; it inherits the ACL of its folder.
func assertCopyMode(*testing.T, string)      {}
func assertPlaintextMode(*testing.T, string) {}
