package domain

import (
	"testing"
	"time"
)

func TestCopyStatus(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC)
	t0 := now.Add(-47 * time.Hour)
	t1 := now.Add(-48 * time.Hour)

	tests := []struct {
		name                   string
		folderSet, passwordSet bool
		state                  CopyState
		copyAt                 *time.Time
		wantState              CopyState
		wantCopiedAt           *time.Time
		wantLate               bool
	}{
		{"folder unset wins", false, true, CopyOK, &t0, CopyFolderUnset, &t0, false},
		{"password unset wins", true, false, CopyOK, &t0, CopyPasswordUnset, &t0, false},
		{"ok within 48 hours", true, true, CopyOK, &t0, CopyOK, &t0, false},
		{"ok at 48 hours", true, true, CopyOK, &t1, CopyOK, &t1, true},
		{"stored password unset reads ok", true, true, CopyPasswordUnset, nil, CopyOK, nil, false},
		{"stored folder unset reads ok", true, true, CopyFolderUnset, &t1, CopyOK, &t1, true},
		{"folder not writable is late", true, true, CopyFolderNotWritable, &t0, CopyFolderNotWritable, &t0, true},
		{"failed is late", true, true, CopyFailed, nil, CopyFailed, nil, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := CopyStatus(tt.folderSet, tt.passwordSet, Settings{CopyState: tt.state, CopyAt: tt.copyAt}, now)

			if got.State != tt.wantState {
				t.Errorf("state = %q, want %q", got.State, tt.wantState)
			}

			if (got.CopiedAt == nil) != (tt.wantCopiedAt == nil) || got.CopiedAt != nil && !got.CopiedAt.Equal(*tt.wantCopiedAt) {
				t.Errorf("copied at = %v, want %v", got.CopiedAt, tt.wantCopiedAt)
			}

			if got.Late != tt.wantLate {
				t.Errorf("late = %v, want %v", got.Late, tt.wantLate)
			}
		})
	}
}
