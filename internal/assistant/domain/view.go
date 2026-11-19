package domain

import (
	"encoding/json"
	"regexp"
	"time"

	"github.com/google/uuid"
)

var formPattern = regexp.MustCompile(`^[a-z][a-z0-9_]{1,39}$`)

// View is a presentation of a read of the turn, built by the server (answer views design, V6).
// Payload is the view without its ID: title, window, verdict, provenance, link, chips, rows, data.
type View struct {
	ID        uuid.UUID
	MessageID uuid.UUID
	Seq       int
	Form      string
	Payload   json.RawMessage
	CreatedAt time.Time
}

// ValidForm reports whether form is a form ID (answer views design, R3).
func ValidForm(form string) bool { return formPattern.MatchString(form) }
