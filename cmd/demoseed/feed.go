package main

import (
	"fmt"
	"time"
)

// feedMonths is how far back the history arrives through statement files instead of typed entries.
const feedMonths = 12

// feedShare is the share of the eligible purchases that arrive through a statement file.
const feedShare = .7

// feedAccounts are the accounts whose institution exports a statement file.
var feedAccounts = []string{"card.itau", "card.nubank", "nubank.checking"}

// descriptors are the texts the institutions print for the payees that the rules and the aliases recognize.
var descriptors = map[string]string{
	"Pão de Açúcar":          "PAO DE ACUCAR-0731 SAO PAULO",
	"Carrefour":              "CARREFOUR HIPER 0217 OSASCO",
	"Mercado Dia":            "MERCADO DIA 1182 SAO PAULO",
	"Empório Santa Luzia":    "EMPORIO SANTA LUZIA SAO PAULO",
	"iFood":                  "IFOOD *PEDIDO",
	"Rappi":                  "RAPPI BR*PEDIDO",
	"99Food":                 "99FOOD*PEDIDO",
	"Uber":                   "UBER *TRIP HELP.UBER.COM",
	"99":                     "99 *CORRIDA",
	"Starbucks":              "STARBUCKS PINHEIROS",
	"Cafeteria Santo Grão":   "SANTO GRAO CAFE SAO PAULO",
	"Drogasil":               "DROGASIL 0442 SAO PAULO",
	"Droga Raia":             "DROGA RAIA 0118 SAO PAULO",
	"Pague Menos":            "PAGUE MENOS 2201 SAO PAULO",
	"Padaria Bella Paulista": "PADARIA BELLA PAULISTA",
}

// feedPrefix names the FITID of the lines of each account.
var feedPrefix = map[string]string{"card.itau": "IT", "card.nubank": "NC", "nubank.checking": "NU"}

// feed holds a purchase back as a statement line when it is eligible and returns whether it did. The balance of the account moves now; the ledger receives the line when the file is imported.
func (s *seeder) feed(d time.Time, via, payee string, cents int64, tags []string) bool {
	name, ok := descriptors[payee]
	if !ok || len(tags) > 0 || d.Before(s.today.AddDate(0, -feedMonths, 0)) {
		return false
	}

	if _, ok := feedPrefix[via]; !ok || s.rng.Float64() >= feedShare {
		return false
	}

	if via == "nubank.checking" {
		name = "Compra no debito " + name
	}

	s.feedSeq++
	s.pending[via] = append(s.pending[via], ofxLine{
		date: compact(iso(d)), amount: reais(-cents), fitid: fmt.Sprintf("%s%s%05d", feedPrefix[via], compact(iso(d)), s.feedSeq), name: name,
	})
	s.bal[s.id(via)] -= cents

	return true
}

// flushFeed imports the held lines of an account as one statement file.
func (s *seeder) flushFeed(key string) {
	lines := s.pending[key]
	if len(lines) == 0 || s.err != nil {
		return
	}

	s.pending[key] = nil

	from, to := lines[0].date, lines[len(lines)-1].date
	content := cardOFX(from, to, lines)

	if key == "nubank.checking" {
		content = bankOFX(from, to, noBalance, lines)
	}

	s.upload("/accounts/"+s.id(key)+"/imports", map[string]string{"format": "ofx"}, fmt.Sprintf("%s-%s.ofx", key, to), content)
}

// flushFeeds imports what every account still holds.
func (s *seeder) flushFeeds() {
	for _, key := range feedAccounts {
		s.flushFeed(key)
	}
}
