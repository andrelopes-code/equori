package app

import (
	"context"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

// writer writes the descriptions of the transactions the ledger creates for one owner: the
// owner's language selects the wording, the owner's region the date layout (ADR 016).
type writer struct {
	domain.Wording
	layout string
}

func (s *Service) writerFor(ctx context.Context, userID int64) (writer, error) {
	l, err := s.profiles.Profile(ctx, userID)
	if err != nil {
		return writer{}, fmt.Errorf("read profile: %w", err)
	}
	w := domain.English()
	if l.Language == "pt" {
		w = domain.Portuguese()
	}
	return writer{w, locale.ConventionsOf(l).DateLayout()}, nil
}

func (w writer) yield(first, last time.Time) string {
	if first.Equal(last) {
		return fmt.Sprintf(w.YieldDay, last.Format(w.layout))
	}
	return fmt.Sprintf(w.YieldPeriod, first.Format(w.layout), last.Format(w.layout))
}
