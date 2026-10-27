package winsvc

import (
	"context"
	"errors"
	"testing"

	"golang.org/x/sys/windows/svc"
)

func execute(t *testing.T, stop bool, err error) (bool, uint32) {
	t.Helper()
	req := make(chan svc.ChangeRequest, 1)
	status := make(chan svc.Status, 8)
	run := func(ctx context.Context) error {
		if stop {
			<-ctx.Done()
		}
		return err
	}
	if stop {
		req <- svc.ChangeRequest{Cmd: svc.Stop}
	}
	return handler{run: run}.Execute(nil, req, status)
}

// W-S1, W-S2: a stop the service manager asked for ends without a failure, whatever serve returns,
// so the recovery action does not restart the service during an upgrade.
func TestExecuteEndsARequestedStopWithoutFailure(t *testing.T) {
	t.Parallel()
	if specific, code := execute(t, true, errors.New("shut down http: context deadline exceeded")); specific || code != 0 {
		t.Fatalf("Execute after Stop = %v, %d; want false, 0", specific, code)
	}
}

// W-S2: serve failing on its own is a failure, which the recovery action restarts.
func TestExecuteReportsAFailure(t *testing.T) {
	t.Parallel()
	if specific, code := execute(t, false, errors.New("listen tcp 127.0.0.1:8080: bind")); !specific || code != 1 {
		t.Fatalf("Execute after a failure = %v, %d; want true, 1", specific, code)
	}
}
