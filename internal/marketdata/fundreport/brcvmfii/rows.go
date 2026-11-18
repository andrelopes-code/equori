package brcvmfii

import (
	"archive/zip"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"math/big"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/fundreport"
)

var isinPattern = regexp.MustCompile(`^BR[A-Z0-9]{4}CTF[0-9A-Z]{3}$`)

var identifierReplacer = strings.NewReplacer(".", "", "/", "", "-", "")

// key is a fund and a month in one member of the archive.
type key struct {
	identifier string
	period     time.Time
}

// codeKey is a trading code in one month.
type codeKey struct {
	period time.Time
	code   string
}

// general is the row of the highest version of a key in the member geral.
type general struct {
	version   int
	code      string
	name      string
	segment   string
	delivered *time.Time
}

// complement is the row of the highest version of a key in the member complemento.
type complement struct {
	version           int
	holders           *int64
	netAssets         *int64
	units             *string
	unitBookValue     *string
	adminFee          *string
	monthYield        *string
	monthAmortization *string
}

// record is a row of a member; get reads a cell by its column name.
type record struct {
	cols  map[string]int
	cells []string
}

// get returns the cell converted from Latin-1 and trimmed; each byte is the rune of its value.
func (r record) get(name string) string {
	i := r.cols[name]
	if i >= len(r.cells) {
		return ""
	}

	runes := make([]rune, len(r.cells[i]))
	for j := range len(r.cells[i]) {
		runes[j] = rune(r.cells[i][j])
	}

	return strings.TrimSpace(string(runes))
}

func readGeneral(zr *zip.Reader, member string) (map[key]general, error) {
	required := []string{
		"CNPJ_Fundo_Classe", "Data_Referencia", "Versao", "Data_Entrega", "Nome_Fundo_Classe",
		"Codigo_ISIN", "Segmento_Atuacao", "Mercado_Negociacao_Bolsa",
	}
	out := map[key]general{}

	err := readMember(zr, member, required, func(r record) {
		isin := r.get("Codigo_ISIN")
		period, periodOK := parsePeriod(r.get("Data_Referencia"))
		version, versionErr := strconv.Atoi(r.get("Versao"))
		name := r.get("Nome_Fundo_Classe")

		if r.get("Mercado_Negociacao_Bolsa") != "S" || !isinPattern.MatchString(isin) ||
			!periodOK || versionErr != nil || name == "" {
			return
		}

		k := key{identifierReplacer.Replace(r.get("CNPJ_Fundo_Classe")), period}
		if old, ok := out[k]; ok && old.version >= version {
			return
		}

		delivered, err := time.Parse(time.DateOnly, r.get("Data_Entrega"))
		out[k] = general{
			version:   version,
			code:      isin[2:6] + "11",
			name:      name,
			segment:   r.get("Segmento_Atuacao"),
			delivered: pointerIf(err == nil, delivered),
		}
	})

	return out, err
}

func readComplement(zr *zip.Reader, member string) (map[key]complement, error) {
	required := []string{
		"CNPJ_Fundo_Classe", "Data_Referencia", "Versao", "Total_Numero_Cotistas",
		"Patrimonio_Liquido", "Cotas_Emitidas", "Valor_Patrimonial_Cotas",
		"Percentual_Despesas_Taxa_Administracao", "Percentual_Dividend_Yield_Mes",
		"Percentual_Amortizacao_Cotas_Mes",
	}
	out := map[key]complement{}

	err := readMember(zr, member, required, func(r record) {
		period, periodOK := parsePeriod(r.get("Data_Referencia"))
		version, versionErr := strconv.Atoi(r.get("Versao"))

		if !periodOK || versionErr != nil {
			return
		}

		k := key{identifierReplacer.Replace(r.get("CNPJ_Fundo_Classe")), period}
		if old, ok := out[k]; ok && old.version >= version {
			return
		}

		holders, holdersErr := strconv.ParseInt(r.get("Total_Numero_Cotistas"), 10, 64)
		out[k] = complement{
			version:           version,
			holders:           pointerIf(holdersErr == nil, holders),
			netAssets:         minorUnits(r.get("Patrimonio_Liquido")),
			units:             decimal(r.get("Cotas_Emitidas")),
			unitBookValue:     decimal(r.get("Valor_Patrimonial_Cotas")),
			adminFee:          decimal(r.get("Percentual_Despesas_Taxa_Administracao")),
			monthYield:        decimal(r.get("Percentual_Dividend_Yield_Mes")),
			monthAmortization: decimal(r.get("Percentual_Amortizacao_Cotas_Mes")),
		}
	})

	return out, err
}

// join pairs each fund and month of general with its complement. A code that two identifiers
// give in one month is marked shared on each of their reports for that month (FR4).
func join(general map[key]general, complements map[key]complement) []fundreport.Report {
	owners := map[codeKey]int{}
	for k, g := range general {
		owners[codeKey{k.period, g.code}]++
	}

	var out []fundreport.Report

	for k, g := range general {
		c := complements[k]
		out = append(out, fundreport.Report{
			Exchange:          exchange,
			Code:              g.code,
			Shared:            owners[codeKey{k.period, g.code}] > 1,
			Period:            k.period,
			Identifier:        k.identifier,
			Name:              g.name,
			Segment:           g.segment,
			Delivered:         g.delivered,
			NetAssets:         c.netAssets,
			Holders:           c.holders,
			Units:             c.units,
			UnitBookValue:     c.unitBookValue,
			AdminFee:          c.adminFee,
			MonthYield:        c.monthYield,
			MonthAmortization: c.monthAmortization,
		})
	}

	return out
}

// readMember calls each for every row of the member; it fails when the member or a required
// column is absent.
func readMember(zr *zip.Reader, member string, required []string, each func(record)) error {
	var entry *zip.File

	for _, f := range zr.File {
		if f.Name == member {
			entry = f
		}
	}

	if entry == nil {
		return fmt.Errorf("read CVM archive: member %s missing", member)
	}

	rc, err := entry.Open()
	if err != nil {
		return fmt.Errorf("open CVM member %s: %w", member, err)
	}

	defer func() { _ = rc.Close() }()

	return readRecords(rc, member, required, each)
}

func readRecords(r io.Reader, member string, required []string, each func(record)) error {
	cr := csv.NewReader(r)
	cr.Comma = ';'
	cr.FieldsPerRecord = -1
	cr.LazyQuotes = true

	header, err := cr.Read()
	if err != nil {
		return fmt.Errorf("read CVM member %s header: %w", member, err)
	}

	cols := make(map[string]int, len(header))
	for i, name := range header {
		cols[strings.TrimSpace(name)] = i
	}

	for _, name := range required {
		if _, ok := cols[name]; !ok {
			return fmt.Errorf("read CVM member %s: column %s missing", member, name)
		}
	}

	for n := 2; ; n++ {
		cells, err := cr.Read()
		if errors.Is(err, io.EOF) {
			return nil
		}

		if err != nil {
			return fmt.Errorf("read CVM member %s line %d: %w", member, n, err)
		}

		each(record{cols: cols, cells: cells})
	}
}

// parsePeriod accepts only the first day of a month.
func parsePeriod(cell string) (time.Time, bool) {
	period, err := time.Parse(time.DateOnly, cell)

	return period, err == nil && period.Day() == 1
}

func pointerIf[T any](ok bool, v T) *T {
	if !ok {
		return nil
	}

	return &v
}

// minorUnits returns the cell times 100, rounded half away from zero; nil when the cell is
// blank, not a number or out of range.
func minorUnits(cell string) *int64 {
	value, ok := new(big.Rat).SetString(cell)
	if !ok {
		return nil
	}

	scaled := new(big.Int).Mul(value.Num(), big.NewInt(100))
	quo, rem := new(big.Int).QuoRem(scaled, value.Denom(), new(big.Int))

	if rem.Abs(rem).Lsh(rem, 1).Cmp(value.Denom()) >= 0 {
		quo.Add(quo, big.NewInt(int64(scaled.Sign())))
	}

	return pointerIf(quo.IsInt64(), quo.Int64())
}

// decimal returns the cell when it is an exact decimal; nil otherwise.
func decimal(cell string) *string {
	_, ok := new(big.Rat).SetString(cell)

	return pointerIf(ok, cell)
}
