package registry

import "regexp"

// IDPattern is the identifier format shared by schema checks and the HTTP contract.
const IDPattern = `^[a-z0-9_]{2,40}$`

var idRE = regexp.MustCompile(IDPattern)

func ValidID(id string) bool {
	return idRE.MatchString(id)
}
