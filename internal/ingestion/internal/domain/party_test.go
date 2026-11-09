package domain

import (
	"encoding/hex"
	"testing"
)

const (
	holderDigestHex     = "79356df8292712e305b550373e815f99f39284e6fb35d701f636add4e2a71678"
	thirdPartyDigestHex = "91fe97f78ba094ba595018b806102a0f3656f689d9a414c33889f035d5681409"
)

func TestPartyKey(t *testing.T) {
	tests := []struct {
		name   string
		scheme string
		value  string
		key    string
		ok     bool
	}{
		{"cpf formatted", "br_cpf", "529.982.247-25", "52998224725", true},
		{"cpf digits", "br_cpf", "52998224725", "52998224725", true},
		{"cpf masked", "br_cpf", "***.982.247-**", "", false},
		{"cpf short", "br_cpf", "529.982.247-2", "", false},
		{"cpf wrong separator", "br_cpf", "529.982.247/25", "", false},
		{"cnpj formatted", "br_cnpj", "18.236.120/0001-58", "18236120000158", true},
		{"cnpj alphanumeric", "br_cnpj", "12.abc.345/01de-35", "12ABC34501DE35", true},
		{"cnpj short", "br_cnpj", "12.345.678/0001-9", "", false},
		{"unknown scheme", "us_ssn", "078-05-1120", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key, ok := PartyKey(PartyID{Scheme: tt.scheme, Value: tt.value})
			if key != tt.key || ok != tt.ok {
				t.Errorf("PartyKey = %q, %v; want %q, %v", key, ok, tt.key, tt.ok)
			}
		})
	}
}

func TestPartyDigest(t *testing.T) {
	tests := []struct {
		name string
		id   PartyID
		hex  string
		ok   bool
	}{
		{"holder", PartyID{"br_cpf", "529.982.247-25"}, holderDigestHex, true},
		{"masked", PartyID{"br_cpf", "***.982.247-**"}, "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			digest, ok := PartyDigest(tt.id)
			if hex.EncodeToString(digest) != tt.hex || ok != tt.ok {
				t.Errorf("PartyDigest = %x, %v; want %q, %v", digest, ok, tt.hex, tt.ok)
			}
		})
	}
}

func TestCounterpartyOf(t *testing.T) {
	holder := mustDigest(t, holderDigestHex)
	holders := [][]byte{holder}
	third := &PartyID{"br_cpf", "111.444.777-35"}

	tests := []struct {
		name    string
		id      *PartyID
		holders [][]byte
		want    string
	}{
		{"nil", nil, holders, ""},
		{"holder", &PartyID{"br_cpf", "529.982.247-25"}, holders, CounterpartyHolder},
		{"third party", third, holders, CounterpartyThirdParty},
		{"masked", &PartyID{"br_cpf", "***.982.247-**"}, holders, ""},
		{"no holders", third, nil, CounterpartyThirdParty},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CounterpartyOf(tt.id, tt.holders); got != tt.want {
				t.Errorf("CounterpartyOf = %q; want %q", got, tt.want)
			}
		})
	}

	if d, _ := PartyDigest(*third); hex.EncodeToString(d) != thirdPartyDigestHex {
		t.Errorf("third party digest = %x; want %s", d, thirdPartyDigestHex)
	}
}

func mustDigest(t *testing.T, s string) []byte {
	t.Helper()

	b, err := hex.DecodeString(s)
	if err != nil {
		t.Fatal(err)
	}

	return b
}
