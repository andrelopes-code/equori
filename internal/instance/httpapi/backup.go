package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/instance/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) getBackup(ctx context.Context, _ *http.Request, _ httpserver.None) (BackupStatus, error) {
	status, err := s.svc.BackupStatus(ctx, auth.MustMemberID(ctx))
	if err != nil {
		return BackupStatus{}, err
	}

	return toBackupStatus(status), nil
}

func (s *Server) runBackup(ctx context.Context, _ *http.Request, _ httpserver.None) (BackupStatus, error) {
	status, err := s.svc.RunBackup(ctx, auth.MustMemberID(ctx))
	if err != nil {
		return BackupStatus{}, err
	}

	return toBackupStatus(status), nil
}

func (s *Server) setCopyPassword(
	ctx context.Context,
	_ *http.Request,
	in SetCopyPasswordJSONRequestBody,
) (httpserver.None, error) {
	if err := s.svc.SetCopyPassword(ctx, auth.MustMemberID(ctx), in.Password); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func toBackupStatus(s domain.BackupStatus) BackupStatus {
	state := BackupStateState("off")
	if s.On {
		state = "on"
	}

	out := BackupStatus{
		Backups: BackupState{State: state, PeriodicAt: s.PeriodicAt, PreMigrationAt: s.PreMigrationAt, Late: s.Late},
		Copy: CopyStatus{
			State: CopyStatusState(s.Copy.State), CopiedAt: s.Copy.CopiedAt, Late: s.Copy.Late,
		},
	}
	if s.Copy.File != "" {
		out.Copy.File = &s.Copy.File
	}

	return out
}
