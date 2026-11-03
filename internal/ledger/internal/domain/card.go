package domain

import (
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
)

type Card struct {
	ID        uuid.UUID
	BooksID   int64
	AccountID uuid.UUID
	Holder    string
	LastFour  string
	Virtual   bool
	Active    bool
	// ForeignChargeBP is the charge, in basis points, on purchases in another currency.
	ForeignChargeBP int
}

// CardEdit holds the fields of a card a caller changes; a nil field stays as it is.
type CardEdit struct {
	Holder   *string
	LastFour *string
	Active   *bool
}

var lastFourPattern = regexp.MustCompile(`^[0-9]{4}$`)

func NewCard(c Card) (Card, error) {
	holder, err := cardHolder(c.Holder)
	if err != nil {
		return Card{}, err
	}

	if err := validLastFour(c.LastFour); err != nil {
		return Card{}, err
	}

	c.Holder = holder

	if c.ForeignChargeBP < 0 || c.ForeignChargeBP > 10000 {
		return Card{}, invalid("foreign_charge_bp", "must be between 0 and 10000")
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

// NewCardEdit validates the fields e sets and returns e with the holder trimmed.
func NewCardEdit(e CardEdit) (CardEdit, error) {
	if e.Holder != nil {
		holder, err := cardHolder(*e.Holder)
		if err != nil {
			return CardEdit{}, err
		}

		e.Holder = &holder
	}

	if e.LastFour != nil {
		if err := validLastFour(*e.LastFour); err != nil {
			return CardEdit{}, err
		}
	}

	return e, nil
}

func cardHolder(holder string) (string, error) {
	holder = strings.TrimSpace(holder)
	if n := utf8.RuneCountInString(holder); n == 0 || n > maxNameLength {
		return "", invalid("holder", "must have 1 to 120 characters")
	}

	return holder, nil
}

func validLastFour(digits string) error {
	if !lastFourPattern.MatchString(digits) {
		return invalid("last_four", "must be the last four digits")
	}

	return nil
}
