package brcvmcia

import (
	"archive/zip"
	"strconv"
	"time"
)

// filed is the row of the highest version of a company and reference date in the general member.
type filed struct {
	version   int
	name      string
	delivered *time.Time
}

func readGeneral(zr *zip.Reader, member string) (map[company]filed, error) {
	required := []string{"CNPJ_CIA", "DT_REFER", "VERSAO", "DENOM_CIA", "DT_RECEB"}
	out := map[company]filed{}

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

		delivered, err := time.Parse(time.DateOnly, r.get("DT_RECEB"))
		out[k] = filed{
			version:   version,
			name:      r.get("DENOM_CIA"),
			delivered: pointerIf(err == nil, delivered),
		}
	})

	return out, err
}
