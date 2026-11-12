package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/instance/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) getVersion(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (VersionStatus, error) {
	status, err := s.svc.VersionStatus(ctx, auth.MustMemberID(ctx))
	if err != nil {
		return VersionStatus{}, err
	}

	return toVersionStatus(status), nil
}

func (s *Server) setUpdateCheck(
	ctx context.Context,
	_ *http.Request,
	in SetUpdateCheckJSONRequestBody,
) (VersionStatus, error) {
	status, err := s.svc.SetUpdateCheck(ctx, auth.MustMemberID(ctx), in.UpdateCheck)
	if err != nil {
		return VersionStatus{}, err
	}

	return toVersionStatus(status), nil
}

func toVersionStatus(v app.VersionStatus) VersionStatus {
	out := VersionStatus{
		Version:      v.Version,
		UpdateCheck:  v.UpdateCheck,
		Newer:        v.Newer,
		Distribution: VersionStatusDistribution(v.Distribution),
	}

	if v.Latest != nil {
		out.Latest = &Release{
			Version:   v.Latest.Version,
			Url:       v.Latest.URL,
			CheckedAt: v.Latest.CheckedAt,
		}
	}

	return out
}
