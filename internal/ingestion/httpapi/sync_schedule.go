package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) GetSyncSchedule(ctx context.Context, _ GetSyncScheduleRequestObject) (GetSyncScheduleResponseObject, error) {
	minutes, err := s.svc.SyncInterval(ctx)
	if err != nil {
		return nil, err
	}

	return GetSyncSchedule200JSONResponse(SyncSchedule{Minutes: int32(minutes)}), nil //nolint:gosec // stored values are 1..1440
}

func (s *Server) SetSyncSchedule(ctx context.Context, req SetSyncScheduleRequestObject) (SetSyncScheduleResponseObject, error) {
	minutes, err := s.svc.SetSyncInterval(ctx, auth.MustMemberID(ctx), int(req.Body.Minutes))
	if err != nil {
		return nil, err
	}

	return SetSyncSchedule200JSONResponse(SyncSchedule{Minutes: int32(minutes)}), nil //nolint:gosec // stored values are 1..1440
}
