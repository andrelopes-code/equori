// Package domain holds the rules of the instance module that need no I/O.
package domain

import "time"

type CopyState string

const (
	CopyFolderUnset       CopyState = "folder_unset"
	CopyPasswordUnset     CopyState = "password_unset"
	CopyOK                CopyState = "ok"
	CopyFolderNotWritable CopyState = "folder_not_writable"
	CopyFailed            CopyState = "failed"

	LateAfter         = 48 * time.Hour
	PeriodicKept      = 7
	CopiesKept        = 7
	MinPasswordLength = 12
)

type Settings struct {
	UpdateCheck   *bool
	CopyPassword  []byte
	CopyState     CopyState
	CopyAttemptAt *time.Time
	CopyAt        *time.Time
	CopyFile      string
}

type BackupStatus struct {
	On                         bool
	PeriodicAt, PreMigrationAt *time.Time
	Late                       bool
	Copy                       CopyStatusView
}

type CopyStatusView struct {
	State    CopyState
	CopiedAt *time.Time
	File     string
	Late     bool
}

// CopyStatus is the read rule of the backup screen (A155.7): the current folder and password
// decide folder_unset and password_unset; otherwise the state of the last attempt holds.
func CopyStatus(folderSet, passwordSet bool, s Settings, now time.Time) CopyStatusView {
	view := CopyStatusView{State: s.CopyState, CopiedAt: s.CopyAt, File: s.CopyFile}

	switch {
	case !folderSet:
		view.State = CopyFolderUnset
	case !passwordSet:
		view.State = CopyPasswordUnset
	case s.CopyState == CopyFolderUnset || s.CopyState == CopyPasswordUnset:
		view.State = CopyOK
	}

	switch view.State {
	case CopyOK:
		view.Late = view.CopiedAt != nil && now.Sub(*view.CopiedAt) >= LateAfter
	case CopyFolderNotWritable, CopyFailed:
		view.Late = true
	}

	return view
}
