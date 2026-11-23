package marketdata_test

import (
	"archive/zip"
	"bytes"
	"math"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const (
	companyWEG   = "84.429.695/0001-11"
	companyIND   = "11.111.111/0001-11"
	companyBANCO = "22.222.222/0001-22"

	companyReportURL = "https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp"
)

// absent marks an account the report lacks.
const absent = int64(math.MinInt64)

type companyPeriodAPI struct {
	Period             string  `json:"period"`
	Months             int     `json:"months"`
	Delivered          *string `json:"delivered"`
	TotalAssets        *int64  `json:"total_assets"`
	CurrentAssets      *int64  `json:"current_assets"`
	Cash               *int64  `json:"cash"`
	ShortInvestments   *int64  `json:"short_investments"`
	CurrentLiabilities *int64  `json:"current_liabilities"`
	ShortDebt          *int64  `json:"short_debt"`
	LongDebt           *int64  `json:"long_debt"`
	Equity             *int64  `json:"equity"`
	Revenue            *int64  `json:"revenue"`
	GrossProfit        *int64  `json:"gross_profit"`
	NetIncome          *int64  `json:"net_income"`
	OperatingCashFlow  *int64  `json:"operating_cash_flow"`
	SharesIssued       *int64  `json:"shares_issued"`
	SharesTreasury     *int64  `json:"shares_treasury"`
}

type companyReportAPI struct {
	Source       string             `json:"source"`
	SourceURL    string             `json:"source_url"`
	Identifier   string             `json:"identifier"`
	Name         string             `json:"name"`
	Consolidated bool               `json:"consolidated"`
	Plan         string             `json:"plan"`
	Currency     string             `json:"currency"`
	Periods      []companyPeriodAPI `json:"periods"`
}

// S598: a tick stores the rows of each file and the listing of the trading codes.
func TestS598CompanyReportTick(t *testing.T) {
	t.Parallel()

	h := companyReportHarness(t, "2026-11-18")
	setCompanyReportFeed(t, h, true)
	h.App.Marketdata.TickFeeds(t.Context())

	got := queryStrings(
		t,
		h,
		`SELECT file || ' ' || identifier || ' ' || period || ' ' || months `+
			`FROM marketdata_company_report ORDER BY file, identifier, period, months`,
	)
	want := []string{
		"dfp_2025 11111111000111 2025-06-30 12",
		"dfp_2025 22222222000122 2025-12-31 12",
		"dfp_2025 84429695000111 2025-12-31 12",
		"itr_2025 84429695000111 2025-09-30 9",
		"itr_2026 84429695000111 2026-09-30 9",
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("stored reports = %v, want %v", got, want)
	}

	got = queryStrings(
		t,
		h,
		`SELECT code || ' ' || exchange || ' ' || identifier FROM marketdata_company_listing `+
			`ORDER BY code`,
	)
	want = []string{
		"BNCX4 BVMF 22222222000122",
		"INDS3 BVMF 11111111000111",
		"WEGE3 BVMF 84429695000111",
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("stored listings = %v, want %v", got, want)
	}
}

// S599: the stored reports follow the enabled feed and the symbol of the source.
func TestS599CompanyReports(t *testing.T) {
	t.Parallel()

	h := companyReportHarness(t, "2026-11-18")
	setCompanyReportFeed(t, h, true)
	h.App.Marketdata.TickFeeds(t.Context())

	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")

	var got struct {
		Items []companyReportAPI `json:"items"`
	}

	r := h.Call(reader, http.MethodGet, "/api/v1/company-reports?code=WEGE3", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("GET /company-reports = %d %s", r.Status, r.Body)
	}

	r.Decode(t, &got)

	if g, w := asJSON(t, got.Items), asJSON(t, []companyReportAPI{wantWEG()}); g != w {
		t.Fatalf("reports = %s, want %s", g, w)
	}

	h.ExpectProblem(
		h.Call(&http.Client{}, http.MethodGet, "/api/v1/company-reports?code=WEGE3", nil),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)

	assertNoCompanyReports(t, h, "NONE99")

	h.MustDo(http.MethodPatch, "/api/v1/instruments/OTHR3", map[string]any{
		"name":     "Other",
		"exchange": "BVMF",
		"symbols":  map[string]string{"br_cvm_cia": "11111111000111"},
	}, http.StatusOK, nil)

	var linked struct {
		Items []companyReportAPI `json:"items"`
	}

	h.MustDo(http.MethodGet, "/api/v1/company-reports?code=OTHR3", nil, http.StatusOK, &linked)

	if g, w := asJSON(t, linked.Items), asJSON(t, []companyReportAPI{wantIND()}); g != w {
		t.Fatalf("OTHR3 reports = %s, want %s", g, w)
	}

	setCompanyReportFeed(t, h, false)
	assertNoCompanyReports(t, h, "WEGE3")
}

// S600: a bank reads the other chart of accounts and leaves the lines it lacks null.
func TestS600CompanyReportOtherPlan(t *testing.T) {
	t.Parallel()

	h := companyReportHarness(t, "2026-11-18")
	setCompanyReportFeed(t, h, true)
	h.App.Marketdata.TickFeeds(t.Context())

	var got struct {
		Items []companyReportAPI `json:"items"`
	}

	h.MustDo(http.MethodGet, "/api/v1/company-reports?code=BNCX4", nil, http.StatusOK, &got)

	if g, w := asJSON(t, got.Items), asJSON(t, []companyReportAPI{wantBanco()}); g != w {
		t.Fatalf("reports = %s, want %s", g, w)
	}
}

// S601: the feed has kind company_report, last 2026-09-30 and a lag of 90 days after the quarter.
func TestS601CompanyReportFeedStale(t *testing.T) {
	t.Parallel()

	for today, stale := range map[string]bool{"2026-11-18": false, "2027-04-01": true} {
		t.Run(today, func(t *testing.T) {
			t.Parallel()

			h := companyReportHarness(t, today)
			setCompanyReportFeed(t, h, true)
			h.App.Marketdata.TickFeeds(t.Context())

			f := feedsOf(t, h)["br_cvm_cia"]
			if f.Kind != "company_report" || !f.Enabled || f.Last == nil ||
				*f.Last != "2026-09-30" || !f.SymbolOverride || f.Stale != stale || f.Error != nil {
				t.Fatalf("br_cvm_cia = %+v", f)
			}
		})
	}
}

// S602: a book of region US gets no suggestion for the Brazilian company report feed.
func TestS602CompanyReportFeedNotSuggestedOutsideBrazil(t *testing.T) {
	t.Parallel()

	h := companyReportHarness(t, "2026-11-18")
	us := h.LoginAs("us@example.com", locale.Locale{Language: "en", Region: "US"}, "USD")

	var list struct {
		Items []feedAPI `json:"items"`
	}

	h.Call(us, http.MethodGet, "/api/v1/market-data/feeds", nil).Decode(t, &list)

	for _, f := range list.Items {
		if f.ID == "br_cvm_cia" {
			if f.Suggested {
				t.Fatal("br_cvm_cia is suggested to a US book")
			}

			return
		}
	}

	t.Fatal("br_cvm_cia is not listed")
}

// S603: the assistant reads the company reports through get_market_data; an account of zero is
// written as zero and a missing account is absent.
func TestS603CompanyReportsTool(t *testing.T) {
	t.Parallel()

	h := companyReportHarness(t, "2026-11-18")
	setCompanyReportFeed(t, h, true)
	h.App.Marketdata.TickFeeds(t.Context())

	var out struct {
		CompanyReports []companyReportAPI `json:"company_reports"`
	}

	args := map[string]any{"view": "company_reports", "code": "WEGE3"}
	toolOutput(t, h, "get_market_data", args, &out)

	if g, w := asJSON(t, out.CompanyReports), asJSON(t, []companyReportAPI{wantWEG()}); g != w {
		t.Fatalf("company reports = %s, want %s", g, w)
	}

	h.MustDo(http.MethodPatch, "/api/v1/instruments/OTHR3", map[string]any{
		"name":     "Other",
		"exchange": "BVMF",
		"symbols":  map[string]string{"br_cvm_cia": "11111111000111"},
	}, http.StatusOK, nil)

	var zero struct {
		CompanyReports []struct {
			Periods []map[string]any `json:"periods"`
		} `json:"company_reports"`
	}

	args["code"] = "OTHR3"
	toolOutput(t, h, "get_market_data", args, &zero)

	want := `[{"periods":[{"current_assets":40000,"delivered":"2025-09-15","equity":60000,` +
		`"months":12,"net_income":-5000,"period":"2025-06-30","revenue":0,"total_assets":100001}]}]`
	if g := asJSON(t, zero.CompanyReports); g != want {
		t.Fatalf("company reports = %s, want %s", g, want)
	}

	if e := h.Tool("get_market_data", map[string]any{"view": "company_reports"}); !e.IsError {
		t.Fatal("company_reports without a code was accepted")
	}
}

func wantWEG() companyReportAPI {
	return companyReportAPI{
		Source: "br_cvm_cia", SourceURL: companyReportURL, Identifier: "84429695000111",
		Name: "WEG S.A.", Consolidated: true, Plan: "standard", Currency: "BRL",
		Periods: []companyPeriodAPI{
			companyPeriod("2026-09-30", 9, "2026-10-28",
				5200000000, 3100000000, 600000000, 100000000, 1600000000, 150000000, 250000000,
				2100000000, 3000000000, 1000000000, 500000000, 550000000, 4197317998, 1488307),
			companyPeriod("2025-12-31", 12, "2026-02-27",
				5000000000, 3000000000, 500000000, 200000000, 1500000000, 100000000, 300000000,
				2000000000, 4000000000, 1300000000, 600050000, 700000000, 4197317998, 1488307),
			companyPeriod("2025-09-30", 9, "2025-10-29",
				4800000000, 2800000000, absent, absent, absent, absent, absent,
				absent, 2900000000, absent, 480000000, absent, absent, absent),
		},
	}
}

func wantIND() companyReportAPI {
	return companyReportAPI{
		Source: "br_cvm_cia", SourceURL: companyReportURL, Identifier: "11111111000111",
		Name: "IND SA", Plan: "standard", Currency: "BRL",
		Periods: []companyPeriodAPI{
			companyPeriod("2025-06-30", 12, "2025-09-15",
				100001, 40000, absent, absent, absent, absent, absent,
				60000, 0, absent, -5000, absent, absent, absent),
		},
	}
}

func wantBanco() companyReportAPI {
	return companyReportAPI{
		Source: "br_cvm_cia", SourceURL: companyReportURL, Identifier: "22222222000122",
		Name: "BANCO X", Consolidated: true, Plan: "other", Currency: "BRL",
		Periods: []companyPeriodAPI{
			companyPeriod("2025-12-31", 12, "2026-03-20",
				90000000000, absent, absent, absent, absent, absent, absent,
				8000000000, absent, absent, 900000000, 300000000, absent, absent),
		},
	}
}

// companyPeriod builds a period from the accounts in the order of the API; absent is null.
func companyPeriod(period string, months int, delivered string, a ...int64) companyPeriodAPI {
	acc := func(i int) *int64 {
		if a[i] == absent {
			return nil
		}

		return &a[i]
	}

	return companyPeriodAPI{
		Period: period, Months: months, Delivered: &delivered,
		TotalAssets: acc(0), CurrentAssets: acc(1), Cash: acc(2), ShortInvestments: acc(3),
		CurrentLiabilities: acc(4), ShortDebt: acc(5), LongDebt: acc(6), Equity: acc(7),
		Revenue: acc(8), GrossProfit: acc(9), NetIncome: acc(10), OperatingCashFlow: acc(11),
		SharesIssued: acc(12), SharesTreasury: acc(13),
	}
}

func companyReportHarness(t *testing.T, today string) *apitest.Harness {
	t.Helper()

	return companyFilesHarness(t, today, companyReportFiles(t))
}

func companyFilesHarness(
	t *testing.T,
	today string,
	files map[string][]byte,
) *apitest.Harness {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, ok := files[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}

		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)

	h := apitest.New(
		t,
		apitest.Today(today),
		apitest.IndexFeeds(nil, map[string]string{"br_cvm_cia": srv.URL}),
	)

	for _, code := range []string{"WEGE3", "BNCX4", "OTHR3"} {
		def := mxrf11()
		def["code"] = code
		def["type"] = "stock"
		h.MustDo(http.MethodPost, "/api/v1/instruments", def, http.StatusCreated, nil)
	}

	return h
}

func setCompanyReportFeed(t *testing.T, h *apitest.Harness, enabled bool) {
	t.Helper()

	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/br_cvm_cia",
		map[string]bool{"enabled": enabled},
		http.StatusOK,
		nil,
	)
}

func assertNoCompanyReports(t *testing.T, h *apitest.Harness, code string) {
	t.Helper()

	var got struct {
		Items []companyReportAPI `json:"items"`
	}

	h.MustDo(http.MethodGet, "/api/v1/company-reports?code="+code, nil, http.StatusOK, &got)

	if got.Items == nil || len(got.Items) != 0 {
		t.Fatalf("company reports of %s = %+v, want none", code, got.Items)
	}
}

func queryStrings(t *testing.T, h *apitest.Harness, sql string) []string {
	t.Helper()

	rows, err := h.Pool.Query(t.Context(), sql)
	if err != nil {
		t.Fatal(err)
	}

	defer rows.Close()

	var out []string

	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}

		out = append(out, s)
	}

	return out
}

// companyReportFiles maps the four archives of the Fixture by path.
func companyReportFiles(t *testing.T) map[string][]byte {
	t.Helper()

	return map[string][]byte{
		"/DFP/DADOS/dfp_cia_aberta_2025.zip": companyZip(t, companyDFP2025()),
		"/ITR/DADOS/itr_cia_aberta_2026.zip": companyZip(t, companyITR2026()),
		"/ITR/DADOS/itr_cia_aberta_2025.zip": companyZip(t, companyITR2025()),
		"/FCA/DADOS/fca_cia_aberta_2026.zip": companyZip(t, companyListings()),
	}
}

func companyDFP2025() map[string]string {
	wegV1 := companyFiling{companyWEG, "2025-12-31", "1", "MIL", "ÚLTIMO", "", "2025-12-31"}
	wegV2 := companyFiling{companyWEG, "2025-12-31", "2", "MIL", "ÚLTIMO", "", "2025-12-31"}
	wegYear := wegV2.since("2025-01-01")
	wegBefore := companyFiling{companyWEG, "2025-12-31", "2", "MIL", "PENÚLTIMO", "", "2024-12-31"}
	banco := companyFiling{companyBANCO, "2025-12-31", "1", "MIL", "ÚLTIMO", "", "2025-12-31"}
	bancoYear := banco.since("2025-01-01")
	ind := companyFiling{companyIND, "2025-06-30", "1", "UNIDADE", "ÚLTIMO", "", "2025-06-30"}
	indYear := companyFiling{
		companyIND, "2025-06-30", "1", "UNIDADE", "ÚLTIMO", "2024-07-01", "2025-06-30",
	}

	return companyMembers("dfp", "2025", map[string][]string{
		"": {
			companyGeneral(companyWEG, "2025-12-31", "1", "2026-02-20"),
			companyGeneral(companyWEG, "2025-12-31", "2", "2026-02-27"),
			companyGeneral(companyIND, "2025-06-30", "1", "2025-09-15"),
			companyGeneral(companyBANCO, "2025-12-31", "1", "2026-03-20"),
		},
		"BPA_con": {
			wegV1.balance("1", "Ativo Total", "1"),
			wegV2.balance("1", "Ativo Total", "50000"),
			wegV2.balance("1.01", "Ativo Circulante", "30000"),
			wegV2.balance("1.01.01", "Caixa e Equivalentes de Caixa", "5000"),
			wegV2.balance("1.01.02", "Aplicações Financeiras", "2000"),
			wegBefore.balance("1", "Ativo Total", "45000"),
			banco.balance("1", "Ativo Total", "900000"),
			banco.balance("1.01", "Caixa e Equivalentes de Caixa", "1000"),
		},
		"BPP_con": {
			wegV2.balance("2.01", "Passivo Circulante", "15000"),
			wegV2.balance("2.01.04", "Empréstimos e Financiamentos", "1000"),
			wegV2.balance("2.02.01", "Empréstimos e Financiamentos", "3000"),
			wegV2.balance("2.03", "Patrimônio Líquido Consolidado", "20000"),
			banco.balance("2.03", "Provisões", "50"),
			banco.balance("2.08", "Patrimônio Líquido Consolidado", "80000"),
		},
		"DRE_con": {
			wegYear.flow("3.01", "Receita de Venda de Bens e/ou Serviços", "40000"),
			wegYear.flow("3.03", "Resultado Bruto", "13000"),
			wegYear.flow("3.11", "Lucro/Prejuízo Consolidado do Período", "6000.5"),
			wegYear.flow("3.11.01", "Atribuído a Sócios da Empresa Controladora", "5800"),
			bancoYear.flow("3.01", "Receitas da Intermediação Financeira", "70000"),
			bancoYear.flow("3.09", "Lucro/Prejuízo Consolidado do Período", "9000"),
			bancoYear.flow("3.11", "Reversão dos Juros sobre Capital Próprio", "0"),
		},
		"DFC_MI_con": {wegYear.flow("6.01", "Caixa Líquido Atividades Operacionais", "7000")},
		"DFC_MD_con": {bancoYear.flow("6.01", "Caixa Líquido Atividades Operacionais", "3000")},
		"BPA_ind": {
			wegV2.balance("1", "Ativo Total", "99999"),
			ind.balance("1", "Ativo Total", "1000.005"),
			ind.balance("1.01", "Ativo Circulante", "400"),
		},
		"BPP_ind": {ind.balance("2.03", "Patrimônio Líquido", "600")},
		"DRE_ind": {
			wegYear.flow("3.11", "Lucro/Prejuízo do Período", "1"),
			indYear.flow("3.01", "Receita de Venda de Bens e/ou Serviços", "0"),
			indYear.flow("3.11", "Lucro/Prejuízo do Período", "-50"),
		},
		"composicao_capital": {
			companyLine(companyWEG, "2025-12-31", "2", "WEG S.A.", "4197317998", "0",
				"4197317998", "1488307", "0", "1488307"),
		},
	})
}

func companyITR2026() map[string]string {
	book := companyFiling{companyWEG, "2026-09-30", "1", "MIL", "ÚLTIMO", "", "2026-09-30"}
	quarter := book.since("2026-07-01")
	year := book.since("2026-01-01")

	return companyMembers("itr", "2026", map[string][]string{
		"": {companyGeneral(companyWEG, "2026-09-30", "1", "2026-10-28")},
		"BPA_con": {
			book.balance("1", "Ativo Total", "52000"),
			book.balance("1.01", "Ativo Circulante", "31000"),
			book.balance("1.01.01", "Caixa e Equivalentes de Caixa", "6000"),
			book.balance("1.01.02", "Aplicações Financeiras", "1000"),
		},
		"BPP_con": {
			book.balance("2.01", "Passivo Circulante", "16000"),
			book.balance("2.01.04", "Empréstimos e Financiamentos", "1500"),
			book.balance("2.02.01", "Empréstimos e Financiamentos", "2500"),
			book.balance("2.03", "Patrimônio Líquido Consolidado", "21000"),
		},
		"DRE_con": {
			quarter.flow("3.01", "Receita de Venda de Bens e/ou Serviços", "10000"),
			quarter.flow("3.03", "Resultado Bruto", "3500"),
			quarter.flow("3.11", "Lucro/Prejuízo Consolidado do Período", "1700"),
			year.flow("3.01", "Receita de Venda de Bens e/ou Serviços", "30000"),
			year.flow("3.03", "Resultado Bruto", "10000"),
			year.flow("3.11", "Lucro/Prejuízo Consolidado do Período", "5000"),
		},
		"DFC_MI_con": {year.flow("6.01", "Caixa Líquido Atividades Operacionais", "5500")},
		"composicao_capital": {
			companyLine(companyWEG, "2026-09-30", "1", "WEG S.A.", "4197317998", "0",
				"4197317998", "1488307", "0", "1488307"),
		},
	})
}

func companyITR2025() map[string]string {
	book := companyFiling{companyWEG, "2025-09-30", "1", "MIL", "ÚLTIMO", "", "2025-09-30"}
	year := book.since("2025-01-01")

	return companyMembers("itr", "2025", map[string][]string{
		"": {companyGeneral(companyWEG, "2025-09-30", "1", "2025-10-29")},
		"BPA_con": {
			book.balance("1", "Ativo Total", "48000"),
			book.balance("1.01", "Ativo Circulante", "28000"),
		},
		"DRE_con": {
			year.flow("3.01", "Receita de Venda de Bens e/ou Serviços", "29000"),
			year.flow("3.11", "Lucro/Prejuízo Consolidado do Período", "4800"),
		},
	})
}

func companyListings() map[string]string {
	const header = "CNPJ_Companhia;Data_Referencia;Versao;ID_Documento;Nome_Empresarial;" +
		"Valor_Mobiliario;Codigo_Negociacao;Composicao_BDR_Unit;Mercado;" +
		"Data_Inicio_Negociacao;Data_Fim_Negociacao"

	rows := []string{
		companyLine(companyWEG, "2026-01-01", "1", "1", "WEG S.A.", "Ações Ordinárias",
			"WEGE3", "", "Bolsa", "2007-06-22", ""),
		companyLine(companyIND, "2026-01-01", "1", "2", "IND SA", "Ações Ordinárias",
			"OLDS3", "", "Bolsa", "2010-01-04", ""),
		companyLine(companyIND, "2026-01-01", "2", "5", "IND SA", "Ações Ordinárias",
			"INDS3", "", "Bolsa", "2010-01-04", ""),
		companyLine(companyBANCO, "2026-01-01", "1", "3", "BANCO X", "Ações Preferenciais",
			"BNCX4", "", "Bolsa", "2010-01-04", ""),
		companyLine(companyBANCO, "2026-01-01", "1", "3", "BANCO X", "Ações Ordinárias",
			"BNCX3", "", "Bolsa", "2010-01-04", "2024-05-01"),
		companyLine(companyBANCO, "2026-01-01", "1", "3", "BANCO X", "Debêntures",
			"BNCX11", "", "Balcão Organizado", "2020-01-01", ""),
		companyLine("33.333.333/0001-33", "2026-01-01", "1", "4", "OUTRA SA",
			"Ações Ordinárias", "DUPL3", "", "Bolsa", "2020-01-01", ""),
		companyLine("44.444.444/0001-44", "2026-01-01", "1", "6", "MAIS SA",
			"Ações Ordinárias", "DUPL3", "", "Bolsa", "2020-01-01", ""),
	}

	return map[string]string{
		"fca_cia_aberta_valor_mobiliario_2026.csv": header + "\n" +
			strings.Join(rows, "\n") + "\n",
	}
}

// companyFiling is the fields every row of one company, period and version share.
type companyFiling struct {
	cnpj, ref, version, scale, order, ini, fim string
}

func (f companyFiling) since(ini string) companyFiling {
	f.ini = ini

	return f
}

func (f companyFiling) balance(code, description, value string) string {
	return companyLine(f.cnpj, f.ref, f.version, companyNames[f.cnpj], "1", "DF", "REAL",
		f.scale, f.order, f.fim, code, description, value, "S")
}

func (f companyFiling) flow(code, description, value string) string {
	return companyLine(f.cnpj, f.ref, f.version, companyNames[f.cnpj], "1", "DF", "REAL",
		f.scale, f.order, f.ini, f.fim, code, description, value, "S")
}

var companyNames = map[string]string{
	companyWEG: "WEG S.A.", companyIND: "IND SA", companyBANCO: "BANCO X",
}

func companyGeneral(cnpj, ref, version, received string) string {
	return companyLine(cnpj, ref, version, companyNames[cnpj], "1", "DFP", "1", received, "link")
}

func companyLine(fields ...string) string { return strings.Join(fields, ";") }

// companyMembers names the members of one archive after its prefix and year, writing the header
// of every statement member and of the capital member and the rows given by kind.
func companyMembers(prefix, year string, rows map[string][]string) map[string]string {
	const (
		balance = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;" +
			"ORDEM_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA"
		flow = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;" +
			"ORDEM_EXERC;DT_INI_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA"
		general = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;CATEG_DOC;ID_DOC;DT_RECEB;LINK_DOC"
		capital = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;QT_ACAO_ORDIN_CAP_INTEGR;" +
			"QT_ACAO_PREF_CAP_INTEGR;QT_ACAO_TOTAL_CAP_INTEGR;QT_ACAO_ORDIN_TESOURO;" +
			"QT_ACAO_PREF_TESOURO;QT_ACAO_TOTAL_TESOURO"
	)

	out := map[string]string{}
	base := prefix + "_cia_aberta_"

	put := func(name, header, kind string) {
		out[base+name+year+".csv"] = header + "\n" + strings.Join(rows[kind], "\n") + "\n"
	}

	put("", general, "")
	put("composicao_capital_", capital, "composicao_capital")

	for _, kind := range []string{
		"BPA_con", "BPA_ind", "BPP_con", "BPP_ind", "DRE_con", "DRE_ind",
		"DFC_MI_con", "DFC_MI_ind", "DFC_MD_con", "DFC_MD_ind",
	} {
		header := balance
		if strings.HasPrefix(kind, "DRE") || strings.HasPrefix(kind, "DFC") {
			header = flow
		}

		put(kind+"_", header, kind)
	}

	return out
}

// companyZip writes each member in Latin-1: every rune of a content is one byte.
func companyZip(t *testing.T, members map[string]string) []byte {
	t.Helper()

	var buf bytes.Buffer

	zw := zip.NewWriter(&buf)

	for name, content := range members {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}

		raw := make([]byte, 0, len(content))

		for _, r := range content {
			if r > 0xff {
				t.Fatalf("member %s holds %q, outside Latin-1", name, r)
			}

			raw = append(raw, byte(r))
		}

		if _, err := w.Write(raw); err != nil {
			t.Fatal(err)
		}
	}

	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}

	return buf.Bytes()
}
