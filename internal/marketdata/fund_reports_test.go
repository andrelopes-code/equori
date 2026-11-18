package marketdata_test

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const fundReportGeral = `Tipo_Fundo_Classe;CNPJ_Fundo_Classe;Data_Referencia;Versao;Data_Entrega;Nome_Fundo_Classe;Codigo_ISIN;Segmento_Atuacao;Mercado_Negociacao_Bolsa
Classe;11.728.688/0001-47;2026-10-01;1;2026-11-13;P` + "\xc1" + `TRIA LOG FII;BRHGLGCTF004;Log` + "\xed" + `stica;S
Classe;11.728.688/0001-47;2026-09-01;1;2026-10-14;PATRIA LOG;BRHGLGCTF004;Log` + "\xed" + `stica;S
Classe;11.728.688/0001-47;2026-09-01;2;2026-10-20;P` + "\xc1" + `TRIA LOG FII;BRHGLGCTF004;Log` + "\xed" + `stica;S
Classe;22.222.222/0001-22;2026-10-01;1;2026-11-12;FUNDO B;BRABCDCTF001;Outros;S
Classe;33.333.333/0001-33;2026-10-01;1;2026-11-12;FUNDO C;BRABCDCTF019;Outros;S
Classe;44.444.444/0001-44;2026-10-01;1;2026-11-12;FUNDO D;0;Outros;S
Classe;55.555.555/0001-55;2026-10-01;1;2026-11-12;FUNDO E;BREFGHCTF002;Outros;N
Classe;66.666.666/0001-66;2026-10-01;1;2026-11-12;FUNDO F;BRXPTOCTF003;Shoppings;S
`

const fundReportComplemento = `CNPJ_Fundo_Classe;Data_Referencia;Versao;Total_Numero_Cotistas;Patrimonio_Liquido;Cotas_Emitidas;Valor_Patrimonial_Cotas;Percentual_Despesas_Taxa_Administracao;Percentual_Dividend_Yield_Mes;Percentual_Amortizacao_Cotas_Mes
11.728.688/0001-47;2026-10-01;1;633787;7656899371.48;46398492;165.02474631029;0.000465;0.006943;0
11.728.688/0001-47;2026-09-01;1;613000;7500000000;45601713;164.5;0.00044;0.007;0
11.728.688/0001-47;2026-09-01;2;613837;7546017797.39;45601713;165.476630173739;0.000446;0.007052;0
22.222.222/0001-22;2026-10-01;1;10;1000;10;100;0;0;0
33.333.333/0001-33;2026-10-01;1;10;1000;10;100;0;0;0
44.444.444/0001-44;2026-10-01;1;10;1000;10;100;0;0;0
55.555.555/0001-55;2026-10-01;1;10;1000;10;100;0;0;0
66.666.666/0001-66;2026-10-01;1;10;;;;abc;;
`

type fundReportPeriodAPI struct {
	Period            string  `json:"period"`
	Delivered         *string `json:"delivered"`
	NetAssets         *int64  `json:"net_assets"`
	Holders           *int64  `json:"holders"`
	Units             *string `json:"units"`
	UnitBookValue     *string `json:"unit_book_value"`
	AdminFee          *string `json:"admin_fee"`
	MonthYield        *string `json:"month_yield"`
	MonthAmortization *string `json:"month_amortization"`
}

type fundReportAPI struct {
	Source     string                `json:"source"`
	SourceURL  string                `json:"source_url"`
	Exchange   string                `json:"exchange"`
	Code       string                `json:"code"`
	Currency   string                `json:"currency"`
	Identifier string                `json:"identifier"`
	Name       string                `json:"name"`
	Segment    string                `json:"segment"`
	Periods    []fundReportPeriodAPI `json:"periods"`
}

func fundReportHarness(t *testing.T, today string) *apitest.Harness {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/inf_mensal_fii_2026.zip" {
			http.NotFound(w, r)
			return
		}

		_, _ = w.Write(fundReportZip(t))
	}))
	t.Cleanup(srv.Close)

	h := apitest.New(
		t,
		apitest.Today(today),
		apitest.IndexFeeds(nil, map[string]string{"br_cvm_fii": srv.URL}),
	)

	for _, code := range []string{"HGLG11", "XPTO11"} {
		def := mxrf11()
		def["code"] = code
		h.MustDo(http.MethodPost, "/api/v1/instruments", def, http.StatusCreated, nil)
	}

	return h
}

func setFundReportFeed(t *testing.T, h *apitest.Harness, enabled bool) {
	t.Helper()

	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/br_cvm_fii",
		map[string]bool{"enabled": enabled},
		http.StatusOK,
		nil,
	)
}

func wantFundReports() []fundReportAPI {
	str := func(s string) *string { return &s }
	num := func(n int64) *int64 { return &n }

	return []fundReportAPI{{
		Source:     "br_cvm_fii",
		SourceURL:  "https://dados.cvm.gov.br/dataset/fii-doc-inf_mensal",
		Exchange:   "BVMF",
		Code:       "HGLG11",
		Currency:   "BRL",
		Identifier: "11728688000147",
		Name:       "PÁTRIA LOG FII",
		Segment:    "Logística",
		Periods: []fundReportPeriodAPI{
			{
				Period:            "2026-10-01",
				Delivered:         str("2026-11-13"),
				NetAssets:         num(765689937148),
				Holders:           num(633787),
				Units:             str("46398492.00000000"),
				UnitBookValue:     str("165.024746310290"),
				AdminFee:          str("0.000465000000"),
				MonthYield:        str("0.006943000000"),
				MonthAmortization: str("0.000000000000"),
			},
			{
				Period:            "2026-09-01",
				Delivered:         str("2026-10-20"),
				NetAssets:         num(754601779739),
				Holders:           num(613837),
				Units:             str("45601713.00000000"),
				UnitBookValue:     str("165.476630173739"),
				AdminFee:          str("0.000446000000"),
				MonthYield:        str("0.007052000000"),
				MonthAmortization: str("0.000000000000"),
			},
		},
	}}
}

// S591, S594: a tick stores the latest version of each period of the funds the exchange lists; the
// two funds that give ABCD11 are stored marked shared (FR4).
func TestS591FundReportTick(t *testing.T) {
	t.Parallel()

	h := fundReportHarness(t, "2026-11-18")
	setFundReportFeed(t, h, true)
	h.App.Marketdata.TickFeeds(t.Context())

	var got []string

	rows, err := h.Pool.Query(
		t.Context(),
		`SELECT code || ' ' || period || ' ' || coalesce(holders::text, '') || `+
			`CASE WHEN shared THEN ' shared ' || identifier ELSE '' END `+
			`FROM marketdata_fund_report ORDER BY code, period, identifier`,
	)
	if err != nil {
		t.Fatal(err)
	}

	defer rows.Close()

	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}

		got = append(got, s)
	}

	want := []string{
		"ABCD11 2026-10-01 10 shared 22222222000122",
		"ABCD11 2026-10-01 10 shared 33333333000133",
		"HGLG11 2026-09-01 613837",
		"HGLG11 2026-10-01 633787",
		"XPTO11 2026-10-01 10",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("stored rows = %v, want %v", got, want)
	}
}

// S592, S593: the stored reports follow the enabled feed.
func TestS592FundReports(t *testing.T) {
	t.Parallel()

	h := fundReportHarness(t, "2026-11-18")
	setFundReportFeed(t, h, true)
	h.App.Marketdata.TickFeeds(t.Context())

	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")

	var got struct {
		Items []fundReportAPI `json:"items"`
	}

	r := h.Call(reader, http.MethodGet, "/api/v1/fund-reports?code=HGLG11", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("GET /fund-reports = %d %s", r.Status, r.Body)
	}

	r.Decode(t, &got)

	if g, w := asJSON(t, got.Items), asJSON(t, wantFundReports()); g != w {
		t.Fatalf("reports = %s, want %s", g, w)
	}

	var blank struct {
		Items []fundReportAPI `json:"items"`
	}

	h.Call(reader, http.MethodGet, "/api/v1/fund-reports?code=XPTO11", nil).Decode(t, &blank)

	ten := int64(10)
	if len(blank.Items) != 1 || !reflect.DeepEqual(
		blank.Items[0].Periods,
		[]fundReportPeriodAPI{
			{Period: "2026-10-01", Delivered: blank.Items[0].Periods[0].Delivered, Holders: &ten},
		},
	) {
		t.Fatalf("XPTO11 = %+v", blank.Items)
	}

	h.ExpectProblem(
		h.Call(&http.Client{}, http.MethodGet, "/api/v1/fund-reports?code=HGLG11", nil),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)

	assertNoFundReports(t, h, "NONE99")

	setFundReportFeed(t, h, false)
	assertNoFundReports(t, h, "HGLG11")
}

// S595: the feed has kind fund_report, last 2026-10-01 and a lag of 20 days after two months.
func TestS595FundReportFeedStale(t *testing.T) {
	t.Parallel()

	for today, stale := range map[string]bool{"2026-11-18": false, "2026-12-22": true} {
		t.Run(today, func(t *testing.T) {
			t.Parallel()

			h := fundReportHarness(t, today)
			setFundReportFeed(t, h, true)
			h.App.Marketdata.TickFeeds(t.Context())

			f := feedsOf(t, h)["br_cvm_fii"]
			if f.Kind != "fund_report" || !f.Enabled || f.Last == nil || *f.Last != "2026-10-01" ||
				f.Stale != stale || f.Error != nil {
				t.Fatalf("br_cvm_fii = %+v", f)
			}
		})
	}
}

// S596: a book of region US gets no suggestion for the Brazilian fund report feed.
func TestS596FundReportFeedNotSuggestedOutsideBrazil(t *testing.T) {
	t.Parallel()

	h := fundReportHarness(t, "2026-11-18")
	us := h.LoginAs("us@example.com", locale.Locale{Language: "en", Region: "US"}, "USD")

	var list struct {
		Items []feedAPI `json:"items"`
	}

	h.Call(us, http.MethodGet, "/api/v1/market-data/feeds", nil).Decode(t, &list)

	for _, f := range list.Items {
		if f.ID == "br_cvm_fii" {
			if f.Suggested {
				t.Fatal("br_cvm_fii is suggested to a US book")
			}

			return
		}
	}

	t.Fatal("br_cvm_fii is not listed")
}

// S597: a code two funds share lists both as candidates; the symbol of the source links one (FR15).
func TestS597FundReportLink(t *testing.T) {
	t.Parallel()

	h := fundReportHarness(t, "2026-11-18")
	setFundReportFeed(t, h, true)
	h.App.Marketdata.TickFeeds(t.Context())

	def := mxrf11()
	def["code"] = "ABCD11"
	h.MustDo(http.MethodPost, "/api/v1/instruments", def, http.StatusCreated, nil)

	type candidate struct {
		Source     string `json:"source"`
		Identifier string `json:"identifier"`
		Name       string `json:"name"`
		Segment    string `json:"segment"`
	}

	var unlinked struct {
		Items      []fundReportAPI `json:"items"`
		Candidates []candidate     `json:"candidates"`
	}

	h.MustDo(http.MethodGet, "/api/v1/fund-reports?code=ABCD11", nil, http.StatusOK, &unlinked)

	wantCandidates := []candidate{
		{"br_cvm_fii", "22222222000122", "FUNDO B", "Outros"},
		{"br_cvm_fii", "33333333000133", "FUNDO C", "Outros"},
	}
	if len(unlinked.Items) != 0 || !reflect.DeepEqual(unlinked.Candidates, wantCandidates) {
		t.Fatalf("unlinked = %+v, want no item and candidates %+v", unlinked, wantCandidates)
	}

	var viaTool struct {
		Candidates []candidate `json:"fund_report_candidates"`
	}

	toolOutput(
		t,
		h,
		"get_market_data",
		map[string]any{"view": "fund_reports", "code": "ABCD11"},
		&viaTool,
	)

	if !reflect.DeepEqual(viaTool.Candidates, wantCandidates) {
		t.Fatalf("tool candidates = %+v, want %+v", viaTool.Candidates, wantCandidates)
	}

	h.MustDo(http.MethodPatch, "/api/v1/instruments/ABCD11", map[string]any{
		"name":     def["name"],
		"exchange": "BVMF",
		"symbols":  map[string]string{"br_cvm_fii": "33333333000133"},
	}, http.StatusOK, nil)

	var linked struct {
		Items      []fundReportAPI `json:"items"`
		Candidates []candidate     `json:"candidates"`
	}

	h.MustDo(http.MethodGet, "/api/v1/fund-reports?code=ABCD11", nil, http.StatusOK, &linked)

	if len(linked.Items) != 1 || len(linked.Candidates) != 0 ||
		linked.Items[0].Identifier != "33333333000133" || linked.Items[0].Name != "FUNDO C" ||
		len(linked.Items[0].Periods) != 1 || linked.Items[0].Periods[0].Period != "2026-10-01" {
		t.Fatalf("linked = %+v, want the report of 33333333000133 alone", linked)
	}
}

// The assistant reads the fund reports through get_market_data.
func TestFundReportsTool(t *testing.T) {
	t.Parallel()

	h := fundReportHarness(t, "2026-11-18")
	setFundReportFeed(t, h, true)
	h.App.Marketdata.TickFeeds(t.Context())

	var out struct {
		FundReports []fundReportAPI `json:"fund_reports"`
	}

	toolOutput(
		t,
		h,
		"get_market_data",
		map[string]any{"view": "fund_reports", "code": "HGLG11"},
		&out,
	)

	if g, w := asJSON(t, out.FundReports), asJSON(t, wantFundReports()); g != w {
		t.Fatalf("fund reports = %s, want %s", g, w)
	}
}

// A figure of zero reaches the assistant as zero; only a blank figure is absent.
func TestFundReportsToolKeepsZero(t *testing.T) {
	t.Parallel()

	h := fundReportHarness(t, "2026-11-18")
	setFundReportFeed(t, h, true)
	h.App.Marketdata.TickFeeds(t.Context())

	_, err := h.Pool.Exec(
		t.Context(),
		`UPDATE marketdata_fund_report SET holders = 0, net_assets = 0 WHERE code = 'XPTO11'`,
	)
	if err != nil {
		t.Fatal(err)
	}

	var out struct {
		FundReports []struct {
			Periods []map[string]any `json:"periods"`
		} `json:"fund_reports"`
	}

	toolOutput(
		t,
		h,
		"get_market_data",
		map[string]any{"view": "fund_reports", "code": "XPTO11"},
		&out,
	)

	want := `[{"periods":[{"delivered":"2026-11-12","holders":0,"net_assets":0,"period":"2026-10-01"}]}]`
	if g := asJSON(t, out.FundReports); g != want {
		t.Fatalf("fund reports = %s, want %s", g, want)
	}
}

func assertNoFundReports(t *testing.T, h *apitest.Harness, code string) {
	t.Helper()

	var got struct {
		Items []fundReportAPI `json:"items"`
	}

	h.MustDo(http.MethodGet, "/api/v1/fund-reports?code="+code, nil, http.StatusOK, &got)

	if got.Items == nil || len(got.Items) != 0 {
		t.Fatalf("fund reports of %s = %+v, want none", code, got.Items)
	}
}

func asJSON(t *testing.T, v any) string {
	t.Helper()

	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}

	return string(b)
}

func fundReportZip(t *testing.T) []byte {
	t.Helper()

	var buf bytes.Buffer

	zw := zip.NewWriter(&buf)

	members := [][2]string{
		{"inf_mensal_fii_geral_2026.csv", fundReportGeral},
		{"inf_mensal_fii_complemento_2026.csv", fundReportComplemento},
	}
	for _, m := range members {
		w, err := zw.Create(m[0])
		if err != nil {
			t.Fatal(err)
		}

		if _, err := w.Write([]byte(strings.TrimSpace(m[1]) + "\n")); err != nil {
			t.Fatal(err)
		}
	}

	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}

	return buf.Bytes()
}
