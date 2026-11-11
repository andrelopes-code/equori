package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) getSyncSchedule(ctx context.Context, _ *http.Request, _ httpserver.None) (SyncSchedule, error) {
	minutes, err := s.svc.SyncInterval(ctx)
	if err != nil {
		return SyncSchedule{}, err
	}

	return SyncSchedule{Minutes: int32(minutes)}, nil //nolint:gosec // stored values are 1..1440
}

func (s *Server) setSyncSchedule(
	ctx context.Context, _ *http.Request, in SetSyncScheduleJSONRequestBody,
) (SyncSchedule, error) {
	minutes, err := s.svc.SetSyncInterval(ctx, auth.MustMemberID(ctx), int(in.Minutes))
	if err != nil {
		return SyncSchedule{}, err
	}

	return SyncSchedule{Minutes: int32(minutes)}, nil //nolint:gosec // stored values are 1..1440
}
