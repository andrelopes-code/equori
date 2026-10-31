package domain

import (
	"time"

	"github.com/google/uuid"
)

// Diagnostic is the content of the diagnostic file: no amount, name or description (P13 A158).
type Diagnostic struct {
	GeneratedAt  time.Time
	Version      string
	BinarySchema int64
	Go, OS, Arch string
	Mode         string
	Server       Server
	Environment  []string
	Tables       []Table
	Backup       BackupStatus
	Connections  []Connection
	Outbox       []OutboxCount
	Log          []LogRecord
}

// Server is what the catalog reports about the database.
type Server struct {
	PostgresVersion string
	LocaleProvider  string
	Locale          string
	Schema          int64
}

// Table is a table name with its estimated row count.
type Table struct {
	Name string
	Rows int64
}

// Connection is one bank connection: no institution name, item or account.
type Connection struct {
	ID         uuid.UUID
	Aggregator string
	State      string
	LastUpdate *time.Time
	Failed     bool
}

type OutboxCount struct {
	Type            string
	Pending, Failed int64
}

type LogRecord struct {
	Time    time.Time
	Level   string
	Message string
	Attrs   map[string]string
}
