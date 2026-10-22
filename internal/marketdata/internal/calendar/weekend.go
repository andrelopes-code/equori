package calendar

import "time"

// Weekend has no holidays; only Saturday and Sunday are non-business days.
var Weekend = Calendar{ID: "weekend", Weekend: []time.Weekday{time.Saturday, time.Sunday}}
