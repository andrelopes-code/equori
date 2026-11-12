package pluggy

import (
	"slices"
	"strings"

	"github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy/client"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

// externalAccounts lists each account followed by its reserved balances that hold an amount
// in the account's currency (A73). A reserved balance without an identification, or with one
// already listed, is left out: the identification is the external key of the connection.
func externalAccounts(accounts []client.Account) []domain.ExternalAccount {
	var out []domain.ExternalAccount

	seen := map[string]bool{}
	for _, a := range accounts {
		out = append(out, domain.ExternalAccount{
			ExternalID: a.ID, Type: a.Type, Subtype: a.Subtype, Name: a.Name,
			NumberLast4: domain.LastDigits(a.Number), Currency: a.CurrencyCode, Holder: holder(a),
		})
		if a.BankData == nil {
			continue
		}

		for _, r := range a.BankData.ReservedBalances {
			held := slices.ContainsFunc(
				r.AvailableAmounts,
				func(x client.ReservedAmount) bool { return x.CurrencyCode == a.CurrencyCode },
			)
			if !held || r.Identification == "" || seen[r.Identification] {
				continue
			}

			seen[r.Identification] = true
			out = append(out, domain.ExternalAccount{
				ExternalID: r.Identification,
				Type:       a.Type,
				Subtype:    client.SubtypeReserve,
				Name:       r.Name,
				Currency:   a.CurrencyCode,
			})
		}
	}

	return out
}

// holder reads the account's tax number as a CPF (11 characters) or a CNPJ (14) once the
// separators are removed; any other length reports none (A217).
func holder(a client.Account) *domain.PartyID {
	switch len(strings.NewReplacer(".", "", "/", "", "-", "").Replace(a.TaxNumber)) {
	case 11:
		return &domain.PartyID{Scheme: "br_cpf", Value: a.TaxNumber}
	case 14:
		return &domain.PartyID{Scheme: "br_cnpj", Value: a.TaxNumber}
	}

	return nil
}
