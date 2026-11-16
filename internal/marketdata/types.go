package marketdata

import (
	"github.com/andrelopes-code/equori/internal/marketdata/domain"
)

var (
	ErrUnknownInstrument = domain.ErrUnknownInstrument
	ErrInstrumentExists  = domain.ErrInstrumentExists
	ErrInstrumentInUse   = domain.ErrInstrumentInUse
	ErrPriceMissing      = domain.ErrPriceMissing
	ErrNoTerms           = domain.ErrNoTerms
	ErrUnknownIndex      = domain.ErrUnknownIndex
	ErrNoSource          = domain.ErrNoSource

	ErrUnknownFeed    = domain.ErrUnknownFeed
	ErrAdminRequired  = domain.ErrAdminRequired
	ErrRefreshRunning = domain.ErrRefreshRunning

	ErrUnofficialSource = domain.ErrUnofficialSource
)

type (
	Instrument   = domain.Instrument
	Price        = domain.Price
	IndexSummary = domain.IndexSummary
	IndexRate    = domain.IndexRate
	FieldError   = domain.FieldError
)

type Feed = domain.Feed
