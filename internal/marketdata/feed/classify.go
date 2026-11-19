package feed

import (
	"regexp"
	"strings"
)

// typeStock is the type a source states for a share, and the only one SecurityType refines.
const typeStock = "stock"

// b3Receipt is the code of a BDR of the B3: four letters and 31 to 35 for a receipt of shares
// (sponsored levels 1 to 3, unsponsored 34 and 35), 39 for a receipt of an ETF.
var b3Receipt = regexp.MustCompile(`^[A-Z]{4}3[1-59]$`)

// accents are the letters of the names SecurityType reads, folded to their base letter.
var accents = strings.NewReplacer("Í", "I", "Á", "A", "Â", "A", "Ã", "A", "É", "E", "Ê", "E")

// SecurityType returns the type of a listing whose source states kind. A source that calls every
// security of an exchange a share (Yahoo answers EQUITY for an ETF, a FII or a BDR of the B3)
// leaves the code and the name as the only evidence, so the exchange decides which say more than
// the source. Region-dependent: one branch per MIC; an exchange without one keeps kind.
func SecurityType(mic, code, name, kind string) string {
	if kind != typeStock {
		return kind
	}

	if mic == "BVMF" {
		if b3Receipt.MatchString(code) {
			return "depositary_receipt"
		}

		return b3Type(accents.Replace(strings.ToUpper(name)), kind)
	}

	return kind
}

// b3Type reads the name of a B3 listing: a fund of index or a class of index is an ETF, and a
// real estate fund is a FII. A company of real estate is a share: its name has no "FUNDO".
func b3Type(name, kind string) string {
	switch {
	case strings.Contains(name, "FUNDO DE INDICE"),
		strings.Contains(name, "CLASSE DE INDICE"),
		strings.Contains(" "+name+" ", " ETF "):
		return "etf"
	case strings.Contains(name, "FUNDO") &&
		(strings.Contains(name, "IMOBILI") || strings.Contains(" "+name+" ", " FII ")):
		return "reit"
	}

	return kind
}
