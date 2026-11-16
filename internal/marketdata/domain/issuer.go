package domain

import (
	"slices"
	"strings"
	"unicode/utf8"
)

const maxIssuerName = 80

var issuerSchemes = []IssuerScheme{
	{ID: "br_cnpj", Normalize: normalizeBRCNPJ},
}

var (
	cnpjFirstWeights  = []int{5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	cnpjSecondWeights = []int{6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
)

// IssuerScheme names a registry of issuer identifiers (A236 FC3, region extension point R1).
type IssuerScheme struct {
	ID        string
	Normalize func(id string) (string, bool) // the stored form, false when invalid
}

// IssuerSchemes returns the registry, ordered by ID.
func IssuerSchemes() []IssuerScheme {
	schemes := slices.Clone(issuerSchemes)
	slices.SortFunc(schemes, func(a, b IssuerScheme) int { return strings.Compare(a.ID, b.ID) })

	return schemes
}

// ValidateIssuer returns the stored form of id: field issuer.scheme "must be a known issuer
// scheme" for an unknown scheme, field issuer.id "is not a valid <scheme> identifier" otherwise.
func ValidateIssuer(scheme, id string) (string, error) {
	for _, s := range issuerSchemes {
		if s.ID != scheme {
			continue
		}

		stored, ok := s.Normalize(id)
		if !ok {
			return "", invalid("issuer.id", "is not a valid "+scheme+" identifier")
		}

		return stored, nil
	}

	return "", invalid("issuer.scheme", "must be a known issuer scheme")
}

// validateIssuer checks an issuer and returns it with the trimmed name and the stored id.
func validateIssuer(issuer Issuer) (Issuer, error) {
	issuer.Name = strings.TrimSpace(issuer.Name)

	switch {
	case utf8.RuneCountInString(issuer.Name) > maxIssuerName:
		return issuer, invalid("issuer.name", "must have at most 80 characters")
	case issuer.Name == "" && (issuer.Scheme != "" || issuer.ID != ""):
		return issuer, invalid("issuer.name", "is required with an identifier")
	case (issuer.Scheme == "") != (issuer.ID == ""):
		return issuer, invalid("issuer.id", "scheme and id are both set or both empty")
	case issuer.Scheme == "":
		return issuer, nil
	}

	id, err := ValidateIssuer(issuer.Scheme, issuer.ID)
	if err != nil {
		return issuer, err
	}

	issuer.ID = id

	return issuer, nil
}

// normalizeBRCNPJ upper-cases id, removes ".", "/", "-" and spaces, and checks the two check
// digits. Source: IN RFB 2.229/2024, art. 1º (Art. 2º, parágrafo único, of IN RFB 2.119/2022)
// and Anexo XV; check digits as stated by the Receita Federal FAQ "CNPJ alfanumérico", read
// 2026-11-16. Each character weighs its ASCII code minus 48; modulo 11; a remainder below 2
// gives digit 0.
func normalizeBRCNPJ(id string) (string, bool) {
	stripped := strings.NewReplacer(".", "", "/", "", "-", "", " ", "").Replace(id)
	stripped = strings.ToUpper(stripped)

	if len(stripped) != 14 {
		return "", false
	}

	for i := range 12 {
		if !isCNPJBase(stripped[i]) {
			return "", false
		}
	}

	first := cnpjDigit(stripped[:12], cnpjFirstWeights)
	second := cnpjDigit(stripped[:12]+string(first), cnpjSecondWeights)

	if stripped[12] != first || stripped[13] != second {
		return "", false
	}

	return stripped, true
}

func isCNPJBase(c byte) bool { return c >= '0' && c <= '9' || c >= 'A' && c <= 'Z' }

func cnpjDigit(base string, weights []int) byte {
	sum := 0
	for i := range base {
		sum += int(base[i]-'0') * weights[i]
	}

	if rem := sum % 11; rem >= 2 {
		return byte('0' + 11 - rem)
	}

	return '0'
}
