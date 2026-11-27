//go:build !windows

package main

func runStop([]string) error { return errNotWindows }
