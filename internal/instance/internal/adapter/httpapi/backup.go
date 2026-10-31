package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/instance/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) GetBackup(ctx context.Context, _ GetBackupRequestObject) (GetBackupResponseObject, error) {
	status, err := s.svc.BackupStatus(ctx, auth.MustMemberID(ctx))
	if err != nil {
		return nil, err
	}

	return GetBackup200JSONResponse(toBackupStatus(status)), nil
}

func (s *Server) RunBackup(ctx context.Context, _ RunBackupRequestObject) (RunBackupResponseObject, error) {
	status, err := s.svc.RunBackup(ctx, auth.MustMemberID(ctx))
	if err != nil {
		return nil, err
	}

	return RunBackup200JSONResponse(toBackupStatus(status)), nil
}

func (s *Server) SetCopyPassword(ctx context.Context, request SetCopyPasswordRequestObject) (SetCopyPasswordResponseObject, error) {
	if err := s.svc.SetCopyPassword(ctx, auth.MustMemberID(ctx), request.Body.Password); err != nil {
		return nil, err
	}

	return SetCopyPassword204Response{}, nil
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
