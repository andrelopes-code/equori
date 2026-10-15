package outbox

import (
	"context"
	"time"
)

func SetClock(d *Dispatcher, now func() time.Time) { d.now = now }

func Drain(ctx context.Context, d *Dispatcher) (int, error) { return d.drain(ctx) }
