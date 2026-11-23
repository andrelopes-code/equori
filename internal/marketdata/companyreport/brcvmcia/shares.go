package brcvmcia

import (
	"archive/zip"
	"cmp"
	"fmt"
	"math/big"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/companyreport"
)

const (
	basicPerShare = "3.99.01."
	paidIn        = "Capital Integralizado"
	issued        = "Capital Emitido"
)

// maxClassRatio is the ratio of the earnings per share of two classes above which a share of one
// is not a share of the other.
var maxClassRatio = big.NewRat(3, 2)

// perShare is the basic earnings per share of one class; ini is the start of its period.
type perShare struct {
	ini   time.Time
	value *big.Rat
}

// counted is a candidate count: the highest version wins, then the paid-in capital, then the
// latest approval.
type counted struct {
	version  int
	paidIn   bool
	approved string
	shares   int64
}

// readCounts reads the member capital_social of the FRE of year.
func readCounts(f *os.File, size int64, year int) ([]companyreport.ShareCount, error) {
	zr, err := zip.NewReader(f, size)
	if err != nil {
		return nil, fmt.Errorf("open CVM archive: %w", err)
	}

	required := []string{
		"CNPJ_Companhia", "Versao", "Tipo_Capital", "Data_Autorizacao_Aprovacao",
		"Quantidade_Total_Acoes",
	}
	best := map[string]counted{}

	err = readMember(
		zr,
		"fre_cia_aberta_capital_social_"+strconv.Itoa(year)+".csv",
		required,
		func(r record) {
			c, ok := parseCount(r)
			if !ok {
				return
			}

			id := identifierReplacer.Replace(r.get("CNPJ_Companhia"))
			if old, found := best[id]; !found || c.compare(old) > 0 {
				best[id] = c
			}
		},
	)
	if err != nil {
		return nil, err
	}

	out := make([]companyreport.ShareCount, 0, len(best))
	for id, c := range best {
		out = append(out, companyreport.ShareCount{Identifier: id, Shares: c.shares})
	}

	slices.SortFunc(out, func(a, b companyreport.ShareCount) int {
		return cmp.Compare(a.Identifier, b.Identifier)
	})

	return out, nil
}

func parseCount(r record) (counted, bool) {
	kind := r.get("Tipo_Capital")
	version, versionErr := strconv.Atoi(r.get("Versao"))
	shares, sharesErr := strconv.ParseInt(r.get("Quantidade_Total_Acoes"), 10, 64)

	if kind != paidIn && kind != issued || versionErr != nil || sharesErr != nil || shares <= 0 {
		return counted{}, false
	}

	return counted{version, kind == paidIn, r.get("Data_Autorizacao_Aprovacao"), shares}, true
}

func (c counted) compare(o counted) int {
	if v := cmp.Compare(c.version, o.version); v != 0 {
		return v
	}

	if c.paidIn != o.paidIn {
		if c.paidIn {
			return 1
		}

		return -1
	}

	return strings.Compare(c.approved, o.approved)
}

// keepPerShare keeps the basic earnings per share of a class that the income statement files.
func (st *statement) keepPerShare(ini time.Time, code, cell string) {
	if !strings.HasPrefix(code, basicPerShare) {
		return
	}

	value, ok := new(big.Rat).SetString(cell)
	if !ok {
		return
	}

	st.perShare = append(st.perShare, perShare{ini, value.Abs(value)})
}

// classesDiffer reports whether a share of one class does not stand for a share of another (AC0):
// their earnings per share differ, or one has none in a company that holds both kinds.
func (st *statement) classesDiffer(c capital) bool {
	var least, greatest *big.Rat

	blank := false

	for _, p := range st.perShare {
		switch {
		case !p.ini.Equal(st.ini):
			continue
		case p.value.Sign() == 0:
			blank = true
			continue
		}

		if least == nil || p.value.Cmp(least) < 0 {
			least = p.value
		}

		if greatest == nil || p.value.Cmp(greatest) > 0 {
			greatest = p.value
		}
	}

	if least == nil {
		return false
	}

	return blank && c.bothKinds() ||
		greatest.Cmp(new(big.Rat).Mul(least, maxClassRatio)) > 0
}

// bothKinds reports whether the ordinary and the preferred shares are each a hundredth of the
// capital or more; a golden share is not.
func (c capital) bothKinds() bool {
	const hundredth = 100

	total := c.ordinary + c.preferred

	return min(c.ordinary, c.preferred)*hundredth >= total && total > 0
}
