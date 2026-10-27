//go:build cluster

package backup

import "testing"

// W-B1: on Windows a dump has no mode; it inherits the ACL of its folder.
func assertPrivateMode(*testing.T, string) {}
