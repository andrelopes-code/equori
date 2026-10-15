package domain

import (
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
)

type Card struct {
	ID        uuid.UUID
	UserID    int64
	AccountID uuid.UUID
	Holder    string
	LastFour  string
	Virtual   bool
	Active    bool
}

var lastFourPattern = regexp.MustCompile(`^[0-9]{4}$`)

func NewCard(c Card) (Card, error) {
	c.Holder = strings.TrimSpace(c.Holder)
	if n := utf8.RuneCountInString(c.Holder); n == 0 || n > maxNameLength {
		return Card{}, invalid("holder", "must have 1 to 120 characters")
	}
	if !lastFourPattern.MatchString(c.LastFour) {
		return Card{}, invalid("last_four", "must be the last four digits")
	}
	c.Active = true
	return c, nil
}

// RequireCard rejects card operations on accounts that are not credit cards.
func RequireCard(a Account) error {
	if a.Kind != KindCreditCard {
		return invalid("account_id", "must be a credit card account")
	}
	return nil
}
