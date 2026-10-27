// Package winsvc runs equori serve as a Windows service and installs that service (ADR 023).
package winsvc

import "errors"

// ErrUnsupported is the answer of every function that manages a service outside Windows.
var ErrUnsupported = errors.New("equori service manages the Windows service; use brew services, a systemd unit or compose elsewhere")
