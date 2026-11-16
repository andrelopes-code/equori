package brifdata_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/institution"
	"github.com/andrelopes-code/equori/internal/marketdata/institution/brifdata"
)

// Rows of the IF.data service of 2026-11-16, reduced: the period 202609 has no row, 202606 has.
// Nu Pagamentos holds figures through its conglomerate C0084693; 00000001 is independent;
// 00000002 is inactive; 00000003 has a conglomerate with no figures.
const (
	cadastro = `{"value":[
{"CodInst":"18236120","NomeInstituicao":"NU PAGAMENTOS S.A.","CodConglomeradoPrudencial":"C0084693","Situacao":"A"},
{"CodInst":"C0084693","NomeInstituicao":"NU PAGAMENTOS - PRUDENCIAL","CodConglomeradoPrudencial":"C0084693","Situacao":"A"},
{"CodInst":"00000001","NomeInstituicao":"BANCO INDEPENDENTE S.A.","CodConglomeradoPrudencial":null,"Situacao":"A"},
{"CodInst":"00000002","NomeInstituicao":"BANCO INATIVO S.A.","CodConglomeradoPrudencial":"C0084693","Situacao":"I"},
{"CodInst":"00000003","NomeInstituicao":"BANCO SEM DADO S.A.","CodConglomeradoPrudencial":"C0000003","Situacao":"A"}]}`

	resumo = `{"value":[
{"CodInst":"C0084693","Conta":"140246","NomeColuna":"Patrimônio Líquido","Saldo":23344610717.36},
{"CodInst":"C0084693","Conta":"141870","NomeColuna":"Lucro Líquido","Saldo":4093040225.39},
{"CodInst":"C0084693","Conta":"79662","NomeColuna":"Índice de Imobilização \n(p)","Saldo":0.0510180760985693},
{"CodInst":"C0084693","Conta":"79664","NomeColuna":"Índice de Basileia \n(n) = (e) / (j)","Saldo":0.155091256405038},
{"CodInst":"00000001","Conta":"140246","NomeColuna":"Patrimônio Líquido","Saldo":-500.5},
{"CodInst":"00000001","Conta":"141870","NomeColuna":"Lucro Líquido","Saldo":null},
{"CodInst":"00000001","Conta":"79664","NomeColuna":"Índice de Basileia \n(n)","Saldo":null},
{"CodInst":"00000001","Conta":"79662","NomeColuna":"Coluna renomeada","Saldo":0.5}]}`

	capital = `{"value":[
{"CodInst":"C0084693","Conta":"79659","NomeColuna":"Índice de Capital Principal \n(l) = (a) / (j)","Saldo":0.117599598739514}]}`

	empty = `{"value":[]}`
)

func TestFetch(t *testing.T) {
	t.Parallel()

	var queries []string

	srv := newService(t, &queries, resumo)

	today := time.Date(2026, 11, 16, 0, 0, 0, 0, time.UTC)

	got, err := brifdata.New(srv.Client(), srv.URL).Fetch(t.Context(), today)
	if err != nil {
		t.Fatal(err)
	}

	if got.Period.Format(time.DateOnly) != "2026-06-30" || got.Currency != "BRL" {
		t.Fatalf("period %s currency %s", got.Period.Format(time.DateOnly), got.Currency)
	}

	// 18236120 reaches its conglomerate; 00000001 reaches itself; the inactive institution and the
	// one whose conglomerate has no figures have no entry.
	if len(got.Entries) != 2 {
		t.Fatalf("entries %+v", got.Entries)
	}

	nu := entry(t, got, "18236120")
	if nu.Scheme != "br_ispb" || nu.ConglomerateCode != "C0084693" ||
		nu.ConglomerateName != "NU PAGAMENTOS - PRUDENCIAL" {
		t.Fatalf("nu %+v", nu)
	}

	assertText(t, "basel", nu.Basel, "0.1550912564")
	assertText(t, "principal capital", nu.PrincipalCapital, "0.1175995987")
	assertText(t, "fixed asset", nu.FixedAsset, "0.0510180761")
	assertMinor(t, "equity", nu.Equity, 2334461071736)
	assertMinor(t, "net income", nu.NetIncome, 409304022539)

	// A null stays nil, a renamed column is ignored and a negative amount keeps its sign.
	solo := entry(t, got, "00000001")
	if solo.ConglomerateCode != "00000001" || solo.ConglomerateName != "BANCO INDEPENDENTE S.A." {
		t.Fatalf("solo %+v", solo)
	}

	if solo.Basel != nil || solo.NetIncome != nil || solo.FixedAsset != nil ||
		solo.PrincipalCapital != nil {
		t.Fatalf("solo figures %+v", solo.Figures)
	}

	assertMinor(t, "solo equity", solo.Equity, -50050)

	// Olinda answers 400 to a space written as "+".
	for _, q := range queries {
		if strings.Contains(q, "+") {
			t.Fatalf("query %s", q)
		}
	}
}

func TestFetchNoPeriod(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(empty))
	}))
	t.Cleanup(srv.Close)

	today := time.Date(2026, 11, 16, 0, 0, 0, 0, time.UTC)

	_, err := brifdata.New(srv.Client(), srv.URL).Fetch(t.Context(), today)
	if err == nil || !strings.Contains(err.Error(), feed.ErrNoData.Error()) {
		t.Fatalf("error %v", err)
	}
}

// IF.data publishes amounts with floating-point noise (-1252985.11999999 on 2026-11-16): the
// amount rounds to the nearest cent.
func TestFetchRoundsToCent(t *testing.T) {
	t.Parallel()

	body := `{"value":[
{"CodInst":"C0084693","Conta":"140246","NomeColuna":"Patrimônio Líquido","Saldo":-1252985.11999999},
{"CodInst":"C0084693","Conta":"141870","NomeColuna":"Lucro Líquido","Saldo":10.005}]}`
	srv := newService(t, new([]string), body)
	today := time.Date(2026, 11, 16, 0, 0, 0, 0, time.UTC)

	got, err := brifdata.New(srv.Client(), srv.URL).Fetch(t.Context(), today)
	if err != nil {
		t.Fatal(err)
	}

	nu := entry(t, got, "18236120")
	assertMinor(t, "equity", nu.Equity, -125298512)
	assertMinor(t, "net income", nu.NetIncome, 1001)
}

func newService(t *testing.T, queries *[]string, resumoBody string) *httptest.Server {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*queries = append(*queries, r.URL.RawQuery)

		path := r.URL.Path

		switch {
		case strings.Contains(path, "AnoMes=202609"):
			_, _ = w.Write([]byte(empty))
		case strings.Contains(path, "IfDataCadastro(AnoMes=202606)"):
			_, _ = w.Write([]byte(cadastro))
		case strings.Contains(path, "AnoMes=202606") && strings.Contains(path, "Relatorio='1'") &&
			r.URL.Query().Get("$top") == "1":
			_, _ = w.Write([]byte(`{"value":[{"CodInst":"C0084693"}]}`))
		case strings.Contains(path, "AnoMes=202606") && strings.Contains(path, "Relatorio='1'"):
			_, _ = w.Write([]byte(resumoBody))
		case strings.Contains(path, "AnoMes=202606") && strings.Contains(path, "Relatorio='5'"):
			_, _ = w.Write([]byte(capital))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)

	return srv
}

func entry(t *testing.T, s institution.Snapshot, identifier string) institution.Entry {
	t.Helper()

	for _, e := range s.Entries {
		if e.Identifier == identifier {
			return e
		}
	}

	t.Fatalf("no entry for %s in %+v", identifier, s.Entries)

	return institution.Entry{}
}

func assertText(t *testing.T, name string, got *string, want string) {
	t.Helper()

	if got == nil || *got != want {
		t.Fatalf("%s = %v, want %s", name, got, want)
	}
}

func assertMinor(t *testing.T, name string, got *int64, want int64) {
	t.Helper()

	if got == nil || *got != want {
		t.Fatalf("%s = %v, want %d", name, got, want)
	}
}
