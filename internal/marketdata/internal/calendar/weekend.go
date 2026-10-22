package calendar

import "time"

// Weekend returns a calendar without holidays; only Saturday and Sunday are non-business days.
func Weekend() Calendar {
	return Calendar{ID: "weekend", Weekend: []time.Weekday{time.Saturday, time.Sunday}}
}
