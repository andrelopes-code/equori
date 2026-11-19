package money

import (
	"fmt"
	"time"
)

// MissingPrice is a conversion that found no price of Instrument in Quote on or before Date. Err
// is the sentinel of the module that returns it.
type MissingPrice struct {
	Instrument, Quote Currency
	Date              time.Time
	Err               error
}

func (e *MissingPrice) Error() string {
	return fmt.Sprintf(
		"%v: %s in %s on %s",
		e.Err,
		e.Instrument,
		e.Quote,
		e.Date.Format(time.DateOnly),
	)
}

func (e *MissingPrice) Unwrap() error { return e.Err }
