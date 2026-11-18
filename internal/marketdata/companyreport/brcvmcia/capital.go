package brcvmcia

import (
	"archive/zip"
	"strconv"
	"time"
)

type capital struct {
	version  int
	issued   *int64
	treasury *int64
}

func readCapital(zr *zip.Reader, member string) (map[company]capital, error) {
	required := []string{
		"CNPJ_CIA", "DT_REFER", "VERSAO", "QT_ACAO_TOTAL_CAP_INTEGR", "QT_ACAO_TOTAL_TESOURO",
	}
	out := map[company]capital{}

	err := readMember(zr, member, required, func(r record) {
		ref, refErr := time.Parse(time.DateOnly, r.get("DT_REFER"))
		version, versionErr := strconv.Atoi(r.get("VERSAO"))

		if refErr != nil || versionErr != nil {
			return
		}

		k := company{identifierReplacer.Replace(r.get("CNPJ_CIA")), ref}
		if old, ok := out[k]; ok && old.version >= version {
			return
		}

		issued, issuedErr := strconv.ParseInt(r.get("QT_ACAO_TOTAL_CAP_INTEGR"), 10, 64)
		treasury, treasuryErr := strconv.ParseInt(r.get("QT_ACAO_TOTAL_TESOURO"), 10, 64)
		out[k] = capital{
			version:  version,
			issued:   pointerIf(issuedErr == nil, issued),
			treasury: pointerIf(treasuryErr == nil, treasury),
		}
	})

	return out, err
}
