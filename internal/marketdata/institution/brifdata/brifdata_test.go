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

	// The quarter before: Nu Pagamentos with a null Basel index.
	resumoMarch = `{"value":[
{"CodInst":"C0084693","Conta":"140246","NomeColuna":"Patrimônio Líquido","Saldo":21000000000.5},
{"CodInst":"C0084693","Conta":"141870","NomeColuna":"Lucro Líquido","Saldo":1420540594.15},
{"CodInst":"C0084693","Conta":"79664","NomeColuna":"Índice de Basileia \n(n)","Saldo":null}]}`

	empty = `{"value":[]}`
)

var today = time.Date(2026, 11, 16, 0, 0, 0, 0, time.UTC)

func TestFetch(t *testing.T) {
	t.Parallel()

	var queries []string

	srv := newService(t, &queries, resumo)

	got, err := brifdata.New(srv.Client(), srv.URL).Fetch(t.Context(), today, nil)
	if err != nil {
		t.Fatal(err)
	}

	if got.Currency != "BRL" || len(got.Periods) != 2 {
		t.Fatalf("currency %s periods %d", got.Currency, len(got.Periods))
	}

	// Newest first: 2026-06-30, then 2026-03-31.
	june, march := got.Periods[0], got.Periods[1]
	if june.End.Format(time.DateOnly) != "2026-06-30" ||
		march.End.Format(time.DateOnly) != "2026-03-31" {
		t.Fatalf("periods %s %s", june.End, march.End)
	}

	// 18236120 reaches its conglomerate; 00000001 reaches itself; the inactive institution and the
	// one whose conglomerate has no figures have no entry.
	if len(june.Entries) != 2 {
		t.Fatalf("entries %+v", june.Entries)
	}

	nu := entry(t, june, "18236120")
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
	solo := entry(t, june, "00000001")
	if solo.ConglomerateCode != "00000001" || solo.ConglomerateName != "BANCO INDEPENDENTE S.A." {
		t.Fatalf("solo %+v", solo)
	}

	if solo.Basel != nil || solo.NetIncome != nil || solo.FixedAsset != nil ||
		solo.PrincipalCapital != nil {
		t.Fatalf("solo figures %+v", solo.Figures)
	}

	assertMinor(t, "solo equity", solo.Equity, -50050)

	// The earlier quarter keeps the null Basel index of the register.
	earlier := entry(t, march, "18236120")
	if earlier.Basel != nil || earlier.PrincipalCapital != nil {
		t.Fatalf("march %+v", earlier.Figures)
	}

	assertMinor(t, "march equity", earlier.Equity, 2100000000050)

	// Olinda answers 400 to a space written as "+".
	for _, q := range queries {
		if strings.Contains(q, "+") {
			t.Fatalf("query %s", q)
		}
	}
}

// A period already stored is not read again; the latest one always is (A237 H1).
func TestFetchSkipsStoredPeriods(t *testing.T) {
	t.Parallel()

	var queries []string

	srv := newService(t, &queries, resumo)
	have := []time.Time{
		time.Date(2026, 6, 30, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 3, 31, 0, 0, 0, 0, time.UTC),
	}

	got, err := brifdata.New(srv.Client(), srv.URL).Fetch(t.Context(), today, have)
	if err != nil {
		t.Fatal(err)
	}

	if len(got.Periods) != 1 || got.Periods[0].End.Format(time.DateOnly) != "2026-06-30" {
		t.Fatalf("periods %+v", got.Periods)
	}

	for _, q := range queries {
		if strings.Contains(q, "AnoMes=202603") {
			t.Fatalf("read the stored period: %s", q)
		}
	}
}

func TestLimits(t *testing.T) {
	t.Parallel()

	got := brifdata.New(http.DefaultClient, "").Limits()
	want := institution.Limits{
		Basel:            institution.Floor{Minimum: "0.08", WithBuffer: "0.105"},
		PrincipalCapital: institution.Floor{Minimum: "0.045", WithBuffer: "0.07"},
		Rule:             "Resolução CMN 4.958/2021",
	}

	if got != want {
		t.Fatalf("limits %+v, want %+v", got, want)
	}
}

func TestFetchNoPeriod(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(empty))
	}))
	t.Cleanup(srv.Close)

	_, err := brifdata.New(srv.Client(), srv.URL).Fetch(t.Context(), today, nil)
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

	got, err := brifdata.New(srv.Client(), srv.URL).Fetch(t.Context(), today, nil)
	if err != nil {
		t.Fatal(err)
	}

	nu := entry(t, got.Periods[0], "18236120")
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
		case strings.Contains(path, "AnoMes=202603") && strings.Contains(path, "Relatorio='1'"):
			_, _ = w.Write([]byte(resumoMarch))
		case strings.Contains(path, "Relatorio='5'"):
			_, _ = w.Write([]byte(empty))
		default:
			_, _ = w.Write([]byte(empty))
		}
	}))
	t.Cleanup(srv.Close)

	return srv
}

func entry(t *testing.T, p institution.Period, identifier string) institution.Entry {
	t.Helper()

	for _, e := range p.Entries {
		if e.Identifier == identifier {
			return e
		}
	}

	t.Fatalf("no entry for %s in %+v", identifier, p.Entries)

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
