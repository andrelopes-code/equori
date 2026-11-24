package brcvmcia

import (
	"archive/zip"
	"strings"
)

const (
	shareCapitalColumn = "Capital Social Integralizado"
	parentEquityColumn = "Patrimônio Líquido"

	// movementDots is the number of dots in the code of a line of level three.
	movementDots = 2
)

// movement is what a line of the statement of changes in equity adds to the share capital and to
// the equity of the parent's holders.
type movement struct {
	capital, equity int64
}

// readMovements keeps the lines of level three that change the capital: the transactions with the
// holders (5.04) and the changes inside the equity (5.06).
func readMovements(
	zr *zip.Reader,
	member string,
	filings map[company]filed,
	into map[company]*statement,
) error {
	required := []string{
		"CNPJ_CIA", "DT_REFER", "VERSAO", "ESCALA_MOEDA", "ORDEM_EXERC", "DT_FIM_EXERC",
		"COLUNA_DF", "CD_CONTA", "DS_CONTA", "VL_CONTA",
	}

	return readMember(zr, member, required, func(r record) {
		rw, ok := parseRow(r, false, filings)
		if !ok || rw.value == nil || strings.Count(rw.code, ".") != movementDots ||
			!strings.HasPrefix(rw.code, "5.04.") && !strings.HasPrefix(rw.code, "5.06.") {
			return
		}

		st := into[rw.key]
		if st == nil {
			st = &statement{}
			into[rw.key] = st
		}

		st.move(rw, r.get("COLUNA_DF"))
	})
}

func (st *statement) move(rw row, column string) {
	if st.movements == nil {
		st.movements = map[string]movement{}
	}

	m := st.movements[rw.code]

	switch column {
	case shareCapitalColumn:
		m.capital = *rw.value
	case parentEquityColumn:
		m.equity = *rw.value
	}

	st.movements[rw.code] = m
}

// capitalRaised reports whether a line that raises the share capital also raises the equity: new
// resources and not reserves. It is nil when no line raises the share capital (CR5).
func (st *statement) capitalRaised() *bool {
	var raised *bool

	for _, m := range st.movements {
		if m.capital <= 0 {
			continue
		}

		fresh := m.equity > 0 || raised != nil && *raised
		raised = &fresh
	}

	return raised
}
