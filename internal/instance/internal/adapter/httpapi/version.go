package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/instance/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) GetVersion(ctx context.Context, _ GetVersionRequestObject) (GetVersionResponseObject, error) {
	status, err := s.svc.VersionStatus(ctx, auth.MustMemberID(ctx))
	if err != nil {
		return nil, err
	}

	return GetVersion200JSONResponse(toVersionStatus(status)), nil
}

func (s *Server) SetUpdateCheck(ctx context.Context, request SetUpdateCheckRequestObject) (SetUpdateCheckResponseObject, error) {
	status, err := s.svc.SetUpdateCheck(ctx, auth.MustMemberID(ctx), request.Body.UpdateCheck)
	if err != nil {
		return nil, err
	}

	return SetUpdateCheck200JSONResponse(toVersionStatus(status)), nil
}

func toVersionStatus(v app.VersionStatus) VersionStatus {
	out := VersionStatus{Version: v.Version, UpdateCheck: v.UpdateCheck, Newer: v.Newer}

	if v.Latest != nil {
		out.Latest = &Release{Version: v.Latest.Version, Url: v.Latest.URL, CheckedAt: v.Latest.CheckedAt}
	}

	return out
}
