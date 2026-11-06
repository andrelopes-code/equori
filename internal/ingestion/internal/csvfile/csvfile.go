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
	"unicode"
	"unicode/utf8"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/charset"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

// Parse reads the records of a CSV file; amounts have scale decimal places.
func Parse(data []byte, p domain.Profile, scale int) (domain.Statement, error) {
	text, err := charset.Decode(data, p.Encoding)
	if err != nil {
		return domain.Statement{}, err
	}

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

	return readRecords(r, cols, header, p, scale)
}

// line is a non-blank row with its line number.
type line struct {
	row []string
	n   int
}

// readRecords reads the data rows; the last p.FooterRows non-blank rows are left out.
func readRecords(r *csv.Reader, cols columns, header []string, p domain.Profile, scale int) (domain.Statement, error) {
	var (
		out     domain.Statement
		pending []line
	)

	add := func(l line) error {
		rec, err := cols.record(l.row, header, p, scale)
		if err != nil {
			return fmt.Errorf("line %d: %w", l.n, err)
		}

		out.Records = append(out.Records, rec)

		return nil
	}

	for {
		row, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}

		n, _ := r.FieldPos(0)
		if err != nil {
			return domain.Statement{}, fmt.Errorf("line %d: %w", n, err)
		}

		if blank(row) {
			continue
		}

		pending = append(pending, line{row, n})
		if len(pending) <= p.FooterRows {
			continue
		}

		if err := add(pending[0]); err != nil {
			return domain.Statement{}, err
		}

		pending = pending[1:]
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
type columns struct{ date, amount, debit, credit, description, id, sign int }

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
		{&c.sign, "sign_column", p.SignColumn},
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
	d, err := p.DateLayout.Parse(cell(row, c.date))
	if err != nil {
		return domain.NormalizedRecord{}, fmt.Errorf("date %q is not %s", cell(row, c.date), p.DateLayout)
	}

	amount, err := c.signedAmount(row, p, scale)
	if err != nil {
		return domain.NormalizedRecord{}, err
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

func (c columns) signedAmount(row []string, p domain.Profile, scale int) (int64, error) {
	decimal, _ := utf8.DecodeRuneInString(p.DecimalSeparator)

	group, _ := utf8.DecodeRuneInString(p.GroupSeparator)
	if p.GroupSeparator == "" {
		group = 0
	}

	if c.amount >= 0 {
		amount, err := domain.MinorUnits(cell(row, c.amount), decimal, group, scale)
		if err != nil {
			return 0, fmt.Errorf("amount: %w", err)
		}

		if p.DebitMarker != "" && strings.EqualFold(c.marker(row), p.DebitMarker) {
			amount = -abs(amount)
		}

		return amount, nil
	}

	debit, credit := cell(row, c.debit), cell(row, c.credit)
	switch {
	case debit != "":
		v, err := domain.MinorUnits(debit, decimal, group, scale)
		if err != nil {
			return 0, fmt.Errorf("debit: %w", err)
		}

		return -abs(v), nil
	case credit != "":
		v, err := domain.MinorUnits(credit, decimal, group, scale)
		if err != nil {
			return 0, fmt.Errorf("credit: %w", err)
		}

		return abs(v), nil
	default:
		return 0, errors.New("both debit and credit are empty")
	}
}

// marker reads the debit mark of a line: its sign column or the letters after the amount.
func (c columns) marker(row []string) string {
	if c.sign >= 0 {
		return cell(row, c.sign)
	}

	text := cell(row, c.amount)

	return text[len(strings.TrimRightFunc(text, unicode.IsLetter)):]
}

func abs(v int64) int64 {
	if v < 0 {
		return -v
	}

	return v
}
