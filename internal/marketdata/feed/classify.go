package feed

import "strings"

// typeStock is the type a source states for a share, and the only one SecurityType refines.
const typeStock = "stock"

// accents are the letters of the names SecurityType reads, folded to their base letter.
var accents = strings.NewReplacer("Í", "I", "Á", "A", "Â", "A", "Ã", "A", "É", "E", "Ê", "E")

// SecurityType returns the type of a listing whose source states kind. A source that calls every
// security of an exchange a share (Yahoo answers EQUITY for an ETF or a FII of the B3) leaves the
// name as the only evidence, so the exchange decides which words say more than the source.
// Region-dependent: one branch per MIC; an exchange without one keeps kind.
func SecurityType(mic, name, kind string) string {
	if kind != typeStock {
		return kind
	}

	if mic == "BVMF" {
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
