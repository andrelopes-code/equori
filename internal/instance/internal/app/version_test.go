package app

import (
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/instance/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
)

// A159.3: a failed check is retried at the next hourly tick; a check that answered waits 24 hours.
func TestCheckDue(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	releases := &releasesStub{err: errors.New("offline")}
	s := NewService(
		consentRepository{},
		nil,
		releases,
		nil,
		nil,
		clock.New(func() time.Time { return now }),
		Config{Version: "v1.0.0"},
		slog.New(slog.DiscardHandler),
	)

	if err := s.CheckVersion(t.Context()); err == nil {
		t.Fatal("CheckVersion error = nil, want an error")
	}

	if !s.checkDue() {
		t.Fatal("checkDue after a failed check = false, want true")
	}

	releases.err = nil
	if err := s.CheckVersion(t.Context()); err != nil {
		t.Fatal(err)
	}

	if s.checkDue() {
		t.Fatal("checkDue after a check that answered = true, want false")
	}

	now = now.Add(24 * time.Hour)

	if !s.checkDue() {
		t.Fatal("checkDue 24 hours after a check that answered = false, want true")
	}
}

// consentRepository holds update_check true; the methods it does not declare are not called.
type consentRepository struct {
	Repository
}

func (consentRepository) Settings(context.Context) (domain.Settings, error) {
	consent := true

	return domain.Settings{UpdateCheck: &consent}, nil
}

type releasesStub struct {
	err error
}

func (r *releasesStub) Latest(context.Context, bool) (string, string, error) {
	if r.err != nil {
		return "", "", r.err
	}

	return "v1.0.1", "https://github.com/andrelopes-code/equori/releases/tag/v1.0.1", nil
}
