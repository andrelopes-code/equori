// Package ofx reads OFX bank and credit card statements, versions 1.x (SGML) and 2.x
// (XML), into domain records. It is part of the ingestion anti-corruption layer.
package ofx

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/charset"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

// tag matches an element: SGML leaves have no end tag, so a value runs to the next "<".
var tag = regexp.MustCompile(`<(/?)([A-Za-z0-9.]+)>([^<]*)`)

var entities = strings.NewReplacer("&amp;", "&", "&lt;", "<", "&gt;", ">", "&quot;", `"`, "&apos;", "'")

// Leaves of a transaction that identify the account; they are never stored (N16).
var accountLeaves = map[string]bool{"ACCTID": true, "BANKID": true, "BRANCHID": true}

// Parse reads a statement whose amounts have scale decimal places (the account currency's).
func Parse(data []byte, scale int) (domain.Statement, error) {
	text := charset.Text(data)
	start := strings.Index(strings.ToUpper(text), "<OFX>")
	if start < 0 {
		return domain.Statement{}, errors.New("not an OFX file: no <OFX> element")
	}
	p := parser{text: text, scale: scale}
	if err := p.run(start); err != nil {
		return domain.Statement{}, err
	}
	if !p.statements {
		return domain.Statement{}, errors.New("no statement: the file has no STMTRS or CCSTMTRS element")
	}
	return p.out, nil
}

type parser struct {
	text       string
	scale      int
	out        domain.Statement
	statements bool
	stack      []string
	txn        map[string]string // leaves of the open STMTTRN
	txnLine    int
	balance    map[string]string // leaves of the open LEDGERBAL
}

func (p *parser) line(offset int) int { return strings.Count(p.text[:offset], "\n") + 1 }

func (p *parser) run(start int) error {
	for _, m := range tag.FindAllStringSubmatchIndex(p.text[start:], -1) {
		closing := p.text[start+m[2]:start+m[3]] == "/"
		name := strings.ToUpper(p.text[start+m[4] : start+m[5]])
		value := strings.TrimSpace(entities.Replace(p.text[start+m[6] : start+m[7]]))
		offset := start + m[0]
		switch {
		case closing:
			if err := p.close(name); err != nil {
				return err
			}
		case value == "":
			p.open(name, offset)
		default:
			if err := p.leaf(name, value, offset); err != nil {
				return err
			}
		}
	}
	if p.txn != nil {
		return fmt.Errorf("unexpected end of file inside STMTTRN opened on line %d", p.txnLine)
	}
	return nil
}

func (p *parser) open(name string, offset int) {
	p.stack = append(p.stack, name)
	switch name {
	case "STMTRS", "CCSTMTRS":
		p.statements = true
	case "STMTTRN":
		p.txn, p.txnLine = map[string]string{}, p.line(offset)
	case "LEDGERBAL":
		p.balance = map[string]string{}
	}
}

// close pops the aggregate; an end tag of a leaf (XML) or of an unopened element is ignored.
func (p *parser) close(name string) error {
	i := len(p.stack) - 1
	for i >= 0 && p.stack[i] != name {
		i--
	}
	if i < 0 {
		return nil
	}
	p.stack = p.stack[:i]
	switch name {
	case "STMTTRN":
		r, err := p.record(p.txn)
		if err != nil {
			return fmt.Errorf("STMTTRN on line %d: %w", p.txnLine, err)
		}
		p.out.Records = append(p.out.Records, r)
		p.txn = nil
	case "LEDGERBAL":
		b, err := p.ledgerBalance(p.balance)
		if err != nil {
			return fmt.Errorf("LEDGERBAL: %w", err)
		}
		p.out.Balance, p.balance = b, nil
	}
	return nil
}

func (p *parser) leaf(name, value string, offset int) error {
	switch {
	case p.txn != nil:
		if !accountLeaves[name] {
			p.txn[name] = value
		}
	case p.balance != nil:
		p.balance[name] = value
	case name == "CURDEF":
		p.out.Currency = value
	case name == "DTSTART" || name == "DTEND":
		d, err := date(value)
		if err != nil {
			return fmt.Errorf("%s on line %d: %w", name, p.line(offset), err)
		}
		if name == "DTSTART" {
			p.out.From = &d
		} else {
			p.out.To = &d
		}
	}
	return nil
}

func (p *parser) record(leaves map[string]string) (domain.NormalizedRecord, error) {
	d, err := date(leaves["DTPOSTED"])
	if err != nil {
		return domain.NormalizedRecord{}, fmt.Errorf("DTPOSTED: %w", err)
	}
	amount, err := minorUnits(leaves["TRNAMT"], p.scale)
	if err != nil {
		return domain.NormalizedRecord{}, fmt.Errorf("TRNAMT: %w", err)
	}
	description := leaves["NAME"]
	if memo := leaves["MEMO"]; memo != "" && memo != description {
		description = strings.TrimSpace(description + " " + memo)
	}
	return domain.NormalizedRecord{ExternalID: leaves["FITID"], Date: d, Amount: amount, Description: description, Raw: leaves}, nil
}

func (p *parser) ledgerBalance(leaves map[string]string) (*domain.Balance, error) {
	d, err := date(leaves["DTASOF"])
	if err != nil {
		return nil, fmt.Errorf("DTASOF: %w", err)
	}
	amount, err := minorUnits(leaves["BALAMT"], p.scale)
	if err != nil {
		return nil, fmt.Errorf("BALAMT: %w", err)
	}
	return &domain.Balance{Date: d, Amount: amount}, nil
}

// date reads the YYYYMMDD prefix of an OFX date-time; time and zone are dropped because
// ledger dates are calendar dates (ADR 005).
func date(s string) (time.Time, error) {
	if len(s) < 8 {
		return time.Time{}, fmt.Errorf("%q is not a date", s)
	}
	d, err := time.Parse("20060102", s[:8])
	if err != nil {
		return time.Time{}, fmt.Errorf("%q is not a date", s)
	}
	return d, nil
}

// minorUnits converts an OFX amount ("-45.90", "-45,90", "+3000") to minor units.
func minorUnits(s string, scale int) (int64, error) {
	if s == "" {
		return 0, errors.New("missing")
	}
	sign := int64(1)
	switch s[0] {
	case '-':
		sign, s = -1, s[1:]
	case '+':
		s = s[1:]
	}
	whole, frac, _ := strings.Cut(strings.Replace(s, ",", ".", 1), ".")
	frac = strings.TrimRight(frac, "0")
	if whole == "" || len(frac) > scale || strings.ContainsAny(whole+frac, ".,") {
		return 0, fmt.Errorf("%q is not an amount with at most %d decimals", s, scale)
	}
	frac += strings.Repeat("0", scale-len(frac))
	n, err := strconv.ParseInt(whole+frac, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%q is not an amount", s)
	}
	return sign * n, nil
}
