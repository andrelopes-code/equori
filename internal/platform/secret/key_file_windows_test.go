package secret

import "testing"

// W-C1: on Windows the key file has no mode; the DACL of the data directory protects it.
func assertPrivateMode(*testing.T, string) {}
