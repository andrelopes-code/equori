package domain

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/registry"
)

const (
	SourceManual = "manual"
	SourceCSV    = "csv"

	MaxImportLines = 10000
	MaxPriceRange  = 366 // days in a GET /prices range
)

type Price struct {
	Instrument money.Currency
	Quote      money.Currency
	Date       time.Time
	Value      money.Rate
	Source     string
}

// Priority orders the sources of one date: the lowest wins (P8 amendment A60).
func Priority(source string) (int16, error) {
	switch source {
	case SourceManual:
		return 1, nil
	case SourceCSV:
		return 2, nil
	}
	if registry.ValidID(source) {
		return 3, nil
	}
	return 0, fmt.Errorf("unknown price source %q", source)
}

var csvHeader = []string{"instrument", "quote_instrument", "date", "value"}

// ParsePriceCSV reads an import file; errors name the line, the header being line 1.
func ParsePriceCSV(content []byte) ([]Price, error) {
	r := csv.NewReader(bytes.NewReader(content))
	r.FieldsPerRecord = len(csvHeader)
	header, err := r.Read()
	if err != nil || !slices.Equal(header, csvHeader) {
		return nil, invalid("line 1", "must be the header instrument,quote_instrument,date,value")
	}
	var out []Price
	for line := 2; ; line++ {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			return out, nil
		}
		field := fmt.Sprintf("line %d", line)
		if err != nil {
			return nil, invalid(field, "must have four comma-separated values")
		}
		if len(out) == MaxImportLines {
			return nil, invalid("file", fmt.Sprintf("must have at most %d lines", MaxImportLines))
		}
		date, err := time.Parse(time.DateOnly, rec[2])
		if err != nil {
			return nil, invalid(field, "date must be YYYY-MM-DD")
		}
		value, err := money.ParseRate(rec[3])
		if err != nil {
			return nil, invalid(field, "value must be a positive decimal with at most 12 decimals")
		}
		out = append(out, Price{Instrument: money.Currency(rec[0]), Quote: money.Currency(rec[1]), Date: date, Value: value, Source: SourceCSV})
	}
}

// maxIntegerPart bounds a rate stored as numeric(30,12): 18 integer digits.
const maxIntegerPart = 1_000_000_000_000_000_000

// StorableRate reports whether r is positive and fits numeric(30,12). Only a rate without
// decimals can reach 18 integer digits in an int64 mantissa.
func StorableRate(r money.Rate) bool {
	return r.Mantissa() > 0 && (r.Scale() > 0 || r.Mantissa() < maxIntegerPart)
}

// ValidRange checks a GET /prices range.
func ValidRange(from, to time.Time) error {
	if to.Before(from) {
		return invalid("to", "must not be before from")
	}
	if to.Sub(from) > MaxPriceRange*24*time.Hour {
		return invalid("to", fmt.Sprintf("must be at most %d days after from", MaxPriceRange))
	}
	return nil
}
