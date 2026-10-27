//go:build !unix

package pgcluster

import "context"

const Database = "equori"

type Cluster struct{}

func (c *Cluster) Bin() string                                 { return "" }
func (c *Cluster) Owned() bool                                 { return false }
func (c *Cluster) DSN(string) string                           { return "" }
func (c *Cluster) Exited() <-chan struct{}                     { return nil }
func (c *Cluster) ExitErr() error                              { return nil }
func (c *Cluster) Stop() error                                 { return nil }
func Start(context.Context, string, string) (*Cluster, error)  { return nil, ErrUnsupported }
func Attach(context.Context, string, string) (*Cluster, error) { return nil, ErrUnsupported }

const socketLimit = 103

func socketFallback(string) (string, error) { return "", ErrUnsupported }
