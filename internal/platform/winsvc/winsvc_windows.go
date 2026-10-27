package winsvc

import (
	"context"
	"errors"
	"fmt"
	"time"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

// IsService reports whether the service manager started this process.
func IsService() bool {
	ok, err := svc.IsWindowsService()
	return err == nil && ok
}

// Run serves the service manager: Stop and PreShutdown cancel the context of run (W-S1). An error
// of run ends the service with exit code 1, which the recovery action restarts.
func Run(name string, run func(context.Context) error) error {
	return svc.Run(name, handler{run: run})
}

type handler struct{ run func(context.Context) error }

func (h handler) Execute(_ []string, req <-chan svc.ChangeRequest, status chan<- svc.Status) (bool, uint32) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- h.run(ctx) }()
	status <- svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptPreShutdown}
	for {
		select {
		case err := <-done:
			if err != nil {
				return true, 1
			}
			return false, 0
		case r := <-req:
			switch r.Cmd {
			case svc.Interrogate:
				status <- r.CurrentStatus
			case svc.Stop, svc.PreShutdown:
				status <- svc.Status{State: svc.StopPending}
				cancel()
			}
		}
	}
}

// Install creates the service, or updates an existing one, to run exe with args under account
// (W-S2): automatic start, a restart 5 s after a failure, the failure count reset after a day.
func Install(name, exe string, args []string, account string) error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connect to the service manager: %w", err)
	}
	defer func() { _ = m.Disconnect() }()
	cfg := mgr.Config{
		DisplayName:      name,
		Description:      "Self-hosted personal finance manager",
		StartType:        mgr.StartAutomatic,
		ServiceStartName: account,
		SidType:          windows.SERVICE_SID_TYPE_UNRESTRICTED,
	}
	s, err := m.OpenService(name)
	if err == nil {
		// An upgrade keeps the service and rewrites its configuration.
		var cur mgr.Config
		if cur, err = s.Config(); err == nil {
			cur.DisplayName, cur.Description, cur.StartType = cfg.DisplayName, cfg.Description, cfg.StartType
			cur.ServiceStartName, cur.SidType = cfg.ServiceStartName, cfg.SidType
			cur.BinaryPathName = commandLine(exe, args)
			err = s.UpdateConfig(cur)
		}
	} else {
		s, err = m.CreateService(name, exe, cfg, args...)
	}
	if err != nil {
		return fmt.Errorf("register service %s: %w", name, err)
	}
	defer func() { _ = s.Close() }()
	if err := s.SetRecoveryActions([]mgr.RecoveryAction{{Type: mgr.ServiceRestart, Delay: 5 * time.Second}}, 86400); err != nil {
		return fmt.Errorf("set recovery of service %s: %w", name, err)
	}
	return nil
}

func commandLine(exe string, args []string) string {
	line := windows.EscapeArg(exe)
	for _, a := range args {
		line += " " + windows.EscapeArg(a)
	}
	return line
}

func Start(name string) error {
	return withService(name, func(s *mgr.Service) error {
		if err := s.Start(); err != nil && !errors.Is(err, windows.ERROR_SERVICE_ALREADY_RUNNING) {
			return fmt.Errorf("start service %s: %w", name, err)
		}
		return nil
	})
}

// Stop stops the service and waits up to wait for the stopped state (W-S3); a service that does
// not exist or does not run is already stopped.
func Stop(name string, wait time.Duration) error {
	err := withService(name, func(s *mgr.Service) error {
		st, err := s.Control(svc.Stop)
		if err != nil && !errors.Is(err, windows.ERROR_SERVICE_NOT_ACTIVE) {
			return fmt.Errorf("stop service %s: %w", name, err)
		}
		for deadline := time.Now().Add(wait); st.State != svc.Stopped; {
			if time.Now().After(deadline) {
				return fmt.Errorf("service %s did not stop within %s", name, wait)
			}
			time.Sleep(200 * time.Millisecond)
			if st, err = s.Query(); err != nil {
				return fmt.Errorf("query service %s: %w", name, err)
			}
		}
		return nil
	})
	if errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST) {
		return nil
	}
	return err
}

// Uninstall stops and deletes the service; the data directory stays (W-S3).
func Uninstall(name string) error {
	if err := Stop(name, 90*time.Second); err != nil {
		return err
	}
	err := withService(name, func(s *mgr.Service) error { return s.Delete() })
	if errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("delete service %s: %w", name, err)
	}
	return nil
}

func withService(name string, f func(*mgr.Service) error) error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connect to the service manager: %w", err)
	}
	defer func() { _ = m.Disconnect() }()
	s, err := m.OpenService(name)
	if err != nil {
		return err
	}
	defer func() { _ = s.Close() }()
	return f(s)
}
