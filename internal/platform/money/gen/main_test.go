package main

import (
	"strings"
	"testing"
)

func listOne(entries ...string) []byte {
	return []byte(`<?xml version="1.0" encoding="UTF-8"?><ISO_4217><CcyTbl>` + strings.Join(entries, "") + `</CcyTbl></ISO_4217>`)
}

func entry(code, name, units string, attrs ...string) string {
	return `<CcyNtry><CtryNm>X</CtryNm><CcyNm ` + strings.Join(attrs, " ") + `>` + name + `</CcyNm><Ccy>` + code + `</Ccy><CcyNbr>1</CcyNbr><CcyMnrUnts>` + units + `</CcyMnrUnts></CcyNtry>`
}

func TestGenerateRejectsExponentChange(t *testing.T) {
	lock := map[string]LockEntry{"ISK": {0, "Iceland Krona"}}
	_, _, err := Generate(listOne(entry("ISK", "Iceland Krona", "2")), lock)
	if err == nil || !strings.Contains(err.Error(), "ISK") {
		t.Fatalf("err = %v", err)
	}
}

func TestGenerateKeepsWithdrawnCodes(t *testing.T) {
	lock := map[string]LockEntry{"SLL": {2, "Leone"}}
	src, newLock, err := Generate(listOne(entry("EUR", "Euro", "2")), lock)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(src), `"SLL": 2`) {
		t.Errorf("source lacks SLL:\n%s", src)
	}
	if got := newLock["SLL"]; got != (LockEntry{2, "Leone"}) {
		t.Errorf("lock SLL = %+v", got)
	}
	if got := newLock["EUR"]; got != (LockEntry{2, "Euro"}) {
		t.Errorf("lock EUR = %+v", got)
	}
}

func TestGenerateExcludes(t *testing.T) {
	src, newLock, err := Generate(listOne(
		entry("EUR", "Euro", "2"),
		entry("CLF", "Unidad de Fomento", "4", `IsFund="true"`),
		entry("XXX", "No currency", "N.A."),
		entry("XAU", "Gold", "N.A."),
		`<CcyNtry><CtryNm>ANTARCTICA</CtryNm><CcyNm>No universal currency</CcyNm></CcyNtry>`,
	), nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, code := range []string{"CLF", "XXX", "XAU"} {
		if strings.Contains(string(src), `"`+code+`"`) {
			t.Errorf("%s present", code)
		}
		if _, ok := newLock[code]; ok {
			t.Errorf("%s in lock", code)
		}
	}
	if !strings.Contains(string(src), `"EUR": 2`) {
		t.Errorf("EUR absent:\n%s", src)
	}
}
