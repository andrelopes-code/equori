//go:build !windows

package winsvc

import (
	"context"
	"time"
)

func IsService() bool { return false }

func Run(string, func(context.Context) error) error { return ErrUnsupported }

func Install(string, string, []string, string) error { return ErrUnsupported }

func Start(string) error { return ErrUnsupported }

func Stop(string, time.Duration) error { return ErrUnsupported }

func Uninstall(string) error { return ErrUnsupported }
