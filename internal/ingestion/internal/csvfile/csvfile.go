// Package csvfile reads bank CSV exports with an account's CSV profile (P4 amendment A13).
// It is part of the ingestion anti-corruption layer.
package csvfile

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/charset"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

// Parse reads the records of a CSV file; amounts have scale decimal places.
func Parse(data []byte, p domain.Profile, scale int) (domain.Statement, error) {
	text := strings.TrimPrefix(charset.Text(data), "\xef\xbb\xbf")
	r := csv.NewReader(strings.NewReader(text))
	r.Comma, _ = utf8.DecodeRuneInString(p.Delimiter)
	r.FieldsPerRecord = -1
	r.LazyQuotes = true

	var header []string
	for i := range p.HeaderRows {
		row, err := r.Read()
		if err != nil {
			return domain.Statement{}, fmt.Errorf("header row %d: %w", i+1, readError(err))
		}
		header = row
	}
	cols, err := resolve(p, header)
	if err != nil {
		return domain.Statement{}, err
	}
	var out domain.Statement
	for {
		row, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		line, _ := r.FieldPos(0)
		if err != nil {
			return domain.Statement{}, fmt.Errorf("line %d: %w", line, err)
		}
		if blank(row) {
			continue
		}
		rec, err := cols.record(row, header, p, scale)
		if err != nil {
			return domain.Statement{}, fmt.Errorf("line %d: %w", line, err)
		}
		out.Records = append(out.Records, rec)
	}
	return out, nil
}

func readError(err error) error {
	if errors.Is(err, io.EOF) {
		return errors.New("the file ends before it")
	}
	return err
}

func blank(row []string) bool {
	for _, c := range row {
		if strings.TrimSpace(c) != "" {
			return false
		}
	}
	return true
}

// columns holds the 0-based index of each profile column; -1 when the profile has none.
type columns struct{ date, amount, debit, credit, description, id int }

func resolve(p domain.Profile, header []string) (columns, error) {
	index := func(field, name string) (int, error) {
		if name == "" {
			return -1, nil
		}
		if header == nil {
			n, _ := strconv.Atoi(name)
			return n - 1, nil
		}
		for i, h := range header {
			if strings.EqualFold(strings.TrimSpace(h), strings.TrimSpace(name)) {
				return i, nil
			}
		}
		return 0, fmt.Errorf("%s %q is not a column of the header", field, name)
	}
	var c columns
	var err error
	for _, f := range []struct {
		dst        *int
		field, col string
	}{
		{&c.date, "date_column", p.DateColumn}, {&c.amount, "amount_column", p.AmountColumn},
		{&c.debit, "debit_column", p.DebitColumn}, {&c.credit, "credit_column", p.CreditColumn},
		{&c.description, "description_column", p.DescriptionColumn}, {&c.id, "id_column", p.IDColumn},
	} {
		if *f.dst, err = index(f.field, f.col); err != nil {
			return columns{}, err
		}
	}
	return c, nil
}

func cell(row []string, i int) string {
	if i < 0 || i >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[i])
}

func (c columns) record(row, header []string, p domain.Profile, scale int) (domain.NormalizedRecord, error) {
	d, err := time.Parse(p.DateLayout.GoLayout(), cell(row, c.date))
	if err != nil {
		return domain.NormalizedRecord{}, fmt.Errorf("date %q is not %s", cell(row, c.date), p.DateLayout)
	}
	decimal, _ := utf8.DecodeRuneInString(p.DecimalSeparator)
	var amount int64
	if c.amount >= 0 {
		if amount, err = domain.MinorUnits(cell(row, c.amount), decimal, scale); err != nil {
			return domain.NormalizedRecord{}, fmt.Errorf("amount: %w", err)
		}
	} else {
		debit, credit := cell(row, c.debit), cell(row, c.credit)
		switch {
		case debit != "":
			v, err := domain.MinorUnits(debit, decimal, scale)
			if err != nil {
				return domain.NormalizedRecord{}, fmt.Errorf("debit: %w", err)
			}
			amount = -abs(v)
		case credit != "":
			v, err := domain.MinorUnits(credit, decimal, scale)
			if err != nil {
				return domain.NormalizedRecord{}, fmt.Errorf("credit: %w", err)
			}
			amount = abs(v)
		default:
			return domain.NormalizedRecord{}, errors.New("both debit and credit are empty")
		}
	}
	if p.AmountSign == domain.SignInverted {
		amount = -amount
	}
	raw := make(map[string]string, len(row))
	for i, v := range row {
		name := "column " + strconv.Itoa(i+1)
		if i < len(header) && strings.TrimSpace(header[i]) != "" {
			name = strings.TrimSpace(header[i])
		}
		raw[name] = v
	}
	return domain.NormalizedRecord{
		ExternalID: cell(row, c.id), Date: d, Amount: amount, Description: cell(row, c.description), Raw: raw,
	}, nil
}

func abs(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}
