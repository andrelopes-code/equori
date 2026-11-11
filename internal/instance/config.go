package instance

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/logring"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// ReleasesURL is the only endpoint the version check requests, with /latest or ?per_page=1
// (A159.2).
const ReleasesURL = "https://api.github.com/repos/andrelopes-code/equori/releases"

// LogRecordsKept is how many warn and error records the diagnostic file holds (A158).
const LogRecordsKept = 200

// LogKeys are the log attributes the diagnostic file keeps (A158).
var LogKeys = []string{"code", "status", "method", "route", "connection_id", "duration"}

type Admins interface {
	IsAdmin(ctx context.Context, memberID int64) (bool, error)
}

// Connection is one bank connection as the diagnostic file reports it (A158).
type Connection struct {
	ID         uuid.UUID
	Aggregator string
	State      string
	LastUpdate *time.Time
	Failed     bool
}

type Config struct {
	Mode        string // "managed" or "external"; "" is "external"
	BackupDir   string // "" turns automatic backups off (A154.2)
	CopyDir     string // "" is the copy state folder_unset (A155.1)
	Dump        func(ctx context.Context, path string) error
	Environment []string
	Log         func() []logring.Record
	ReleaseURL  string // "" is ReleasesURL
	// Distribution is EQUORI_DISTRIBUTION: "compose" names the form of compose.yaml (A194.1).
	Distribution string
	// Set by internal/server.
	Version                      string
	SecretKey, PreviousSecretKey string
	Clock                        clock.Clock
	Admins                       Admins
	Outbox                       func(ctx context.Context) ([]outbox.Count, error)
	Connections                  func(ctx context.Context) ([]Connection, error)
}
