//go:build !windows

package main

func runTray([]string) error { return errNotWindows }
