package brcvmcia

import (
	"archive/zip"
	"strconv"
	"time"
)

type capital struct {
	issued   *int64
	treasury *int64
	// ordinary and preferred are the counts of each kind; zero when the cell is not a number.
	ordinary, preferred int64
}

// readCapital keeps the row whose version is the one the general member filed.
func readCapital(
	zr *zip.Reader,
	member string,
	filings map[company]filed,
) (map[company]capital, error) {
	required := []string{
		"CNPJ_CIA", "DT_REFER", "VERSAO", "QT_ACAO_TOTAL_CAP_INTEGR", "QT_ACAO_TOTAL_TESOURO",
		"QT_ACAO_ORDIN_CAP_INTEGR", "QT_ACAO_PREF_CAP_INTEGR",
	}
	out := map[company]capital{}

	err := readMember(zr, member, required, func(r record) {
		ref, refErr := time.Parse(time.DateOnly, r.get("DT_REFER"))
		version, versionErr := strconv.Atoi(r.get("VERSAO"))

		if refErr != nil || versionErr != nil {
			return
		}

		k := company{identifierReplacer.Replace(r.get("CNPJ_CIA")), ref}
		if filings[k].version != version {
			return
		}

		issued, issuedErr := strconv.ParseInt(r.get("QT_ACAO_TOTAL_CAP_INTEGR"), 10, 64)
		treasury, treasuryErr := strconv.ParseInt(r.get("QT_ACAO_TOTAL_TESOURO"), 10, 64)
		ordinary, _ := strconv.ParseInt(r.get("QT_ACAO_ORDIN_CAP_INTEGR"), 10, 64)
		preferred, _ := strconv.ParseInt(r.get("QT_ACAO_PREF_CAP_INTEGR"), 10, 64)
		out[k] = capital{
			issued:    pointerIf(issuedErr == nil, issued),
			treasury:  pointerIf(treasuryErr == nil, treasury),
			ordinary:  ordinary,
			preferred: preferred,
		}
	})

	return out, err
}
