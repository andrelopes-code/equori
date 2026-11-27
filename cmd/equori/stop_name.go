package main

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// stopEventName is the named event that `stop` signals and the tray of dataDir waits on (PW3.4).
func stopEventName(dataDir string) string {
	folder := strings.TrimRight(strings.ToLower(dataDir), `\/`)
	sum := sha256.Sum256([]byte(folder))

	return `Local\equori-stop-` + hex.EncodeToString(sum[:])[:16]
}
