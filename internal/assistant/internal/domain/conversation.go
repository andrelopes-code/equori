package domain

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
)

type Outcome string

const (
	OutcomeNone      Outcome = ""
	OutcomeAnswered  Outcome = "answered"
	OutcomeStepLimit Outcome = "step_limit"
	OutcomeFailed    Outcome = "failed"
	OutcomeCanceled  Outcome = "canceled"
)

const (
	MaxTitle   = 80
	MaxMessage = 4000  // runes of user text
	MaxAnswer  = 16000 // runes of assistant text
)

type Conversation struct {
	ID                   uuid.UUID
	Title                string
	CreatedAt, UpdatedAt time.Time
}

type Message struct {
	ID, ConversationID uuid.UUID
	Seq                int
	Role               Role
	Content            string
	Outcome            Outcome
	CreatedAt          time.Time
}

// Title derives a conversation title from its first message: whitespace collapsed, at most MaxTitle runes,
// cut at the last space before rune MaxTitle when one exists after rune MaxTitle/2.
func Title(text string) string {
	runes := []rune(strings.Join(strings.Fields(text), " "))
	if len(runes) <= MaxTitle {
		return string(runes)
	}
	runes = runes[:MaxTitle]
	for i := MaxTitle - 1; i > MaxTitle/2; i-- {
		if runes[i] == ' ' {
			return string(runes[:i])
		}
	}
	return string(runes)
}
