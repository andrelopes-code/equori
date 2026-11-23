package marketdata_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const (
	companyX = "55555555000155"

	// figuresX is the answer of GET /company-figures for the company X of AC17.
	figuresX = `[{"currency":"BRL","current_ratio":{"date":"2026-09-30","value":"1.5"},` +
		`"gross_profit_to_assets":{"date":"2026-09-30","value":"0.383333"},"name":"X S.A.",` +
		`"net_debt_to_equity":{"date":"2026-09-30","value":"0.4"},` +
		`"net_margin":{"date":"2026-09-30","value":"0.1"},` +
		`"positive_years":{"positive":1,"years":1},` +
		`"price_book":{"date":"2026-09-30","value":"2.5"},"price_date":"2026-10-30",` +
		`"price_earnings":{"date":"2026-09-30","value":"10"},` +
		`"profit":{"date":"2026-09-30","months":9,"rate":"0.2","state":"rate"},` +
		`"return_on_equity":{"date":"2026-09-30","value":"0.23"},` +
		`"revenue":{"date":"2026-09-30","months":9,"rate":"0.2","state":"rate"},` +
		`"revenue_growth":{"reason":"short_history"},"source":"br_cvm_cia",` +
		`"source_url":"` + companyReportURL + `"}]`
)

// S693: the figures of a company, at today's price, for a member of the book.
func TestS693CompanyFigures(t *testing.T) {
	t.Parallel()

	h := companyFigureHarness(t)
	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")

	var got struct {
		Items []map[string]any `json:"items"`
	}

	res := h.Call(reader, http.MethodGet, "/api/v1/company-figures?code=COMX3", nil)
	if res.Status != http.StatusOK {
		t.Fatalf("GET /company-figures = %d %s", res.Status, res.Body)
	}

	res.Decode(t, &got)

	if g := asJSON(t, got.Items); g != figuresX {
		t.Fatalf("figures = %s, want %s", g, figuresX)
	}

	h.ExpectProblem(
		h.Call(&http.Client{}, http.MethodGet, "/api/v1/company-figures?code=COMX3", nil),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)

	var none struct {
		Items []map[string]any `json:"items"`
	}

	h.MustDo(http.MethodGet, "/api/v1/company-figures?code=NONE99", nil, http.StatusOK, &none)

	if none.Items == nil || len(none.Items) != 0 {
		t.Fatalf("figures of an unknown code = %+v, want none", none.Items)
	}
}

// S694: the tool returns the figures of S693.
func TestS694CompanyFiguresTool(t *testing.T) {
	t.Parallel()

	h := companyFigureHarness(t)

	var out struct {
		CompanyFigures []struct {
			PriceEarnings  map[string]string `json:"price_earnings"`
			ReturnOnEquity map[string]string `json:"return_on_equity"`
			RevenueGrowth  map[string]string `json:"revenue_growth"`
			PriceDate      string            `json:"price_date"`
			Profit         map[string]any    `json:"profit"`
			FiscalYears    int               `json:"fiscal_years"`
		} `json:"company_figures"`
	}

	args := map[string]any{"view": "company_figures", "code": "COMX3"}
	toolOutput(t, h, "get_market_data", args, &out)

	want := `[{"price_earnings":{"date":"2026-09-30","value":"10"},` +
		`"return_on_equity":{"date":"2026-09-30","value":"0.23"},` +
		`"revenue_growth":{"reason":"short_history"},"price_date":"2026-10-30",` +
		`"profit":{"date":"2026-09-30","months":9,"rate":"0.2","state":"rate"},"fiscal_years":1}]`
	if g := asJSON(t, out.CompanyFigures); g != want {
		t.Fatalf("figures = %s, want %s", g, want)
	}

	if e := h.Tool("get_market_data", map[string]any{"view": "company_figures"}); !e.IsError {
		t.Fatal("company_figures without a code was accepted")
	}
}

// AC7: the range reads the official price of each fiscal year end, never an unofficial one.
func TestCompanyFiguresRange(t *testing.T) {
	t.Parallel()

	h := companyFigureHarness(t)
	exec := func(sql string) {
		if _, err := h.Pool.Exec(t.Context(), sql); err != nil {
			t.Fatal(err)
		}
	}

	exec(`UPDATE marketdata_company_report SET shares_issued = 1000000, shares_treasury = 0
		WHERE months = 12`)
	exec(`INSERT INTO marketdata_company_report (source, identifier, period, months, file,
			currency, name, consolidated, plan, equity, net_income, shares_issued)
		SELECT 'br_cvm_cia', '` + companyX + `', make_date(y, 12, 31), 12, 'dfp_' || y, 'BRL',
			'X S.A.', false, 'standard', 41000000, 10000000, 1000000
		FROM generate_series(2022, 2024) AS y`)
	exec(`INSERT INTO marketdata_company_share_count (source, identifier, year, shares)
		SELECT 'br_cvm_cia', '` + companyX + `', y, 1000000 FROM generate_series(2022, 2025) AS y`)
	// Prices over earnings 8, 9, 10 and 11; the year 2022 has an unofficial price alone.
	exec(`INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority)
		VALUES ('COMX3', 'BRL', '2025-12-30', 0.8, 'b3_cotahist', 3),
			('COMX3', 'BRL', '2024-12-30', 0.9, 'b3_cotahist', 3),
			('COMX3', 'BRL', '2024-12-31', 5, 'yahoo_chart', 5),
			('COMX3', 'BRL', '2023-12-28', 1, 'b3_cotahist', 3),
			('COMX3', 'BRL', '2022-12-30', 1.1, 'yahoo_chart', 5)`)

	var got struct {
		Items []struct {
			Earnings map[string]any `json:"price_earnings_range"`
			Book     map[string]any `json:"price_book_range"`
		} `json:"items"`
	}

	h.MustDo(http.MethodGet, "/api/v1/company-figures?code=COMX3", nil, http.StatusOK, &got)

	want := `[{"price_earnings_range":{"greatest":"10","least":"8","years":3},` +
		`"price_book_range":{"greatest":"2.439024","least":"1.95122","years":3}}]`
	if g := asJSON(t, got.Items); g != want {
		t.Fatalf("ranges = %s, want %s", g, want)
	}
}

// AC0, AC15: a tick stores the share counts of the FRE and the shares of a listed unit.
func TestCompanyShareCountsTick(t *testing.T) {
	t.Parallel()

	files := companyReportFiles(t)
	files["/FRE/DADOS/fre_cia_aberta_2026.zip"] = companyZip(t, companyCounts("2026", "4197317998"))
	h := companyFilesHarness(t, "2026-11-18", files)
	setCompanyReportFeed(t, h, true)

	_, err := h.Pool.Exec(t.Context(), `INSERT INTO marketdata_company_share_count
		(source, identifier, year, shares)
		VALUES ('br_cvm_cia', 'OLD', 2020, 1), ('br_cvm_cia', 'OLD', 2026, 1),
			('br_cvm_cia', 'KEPT', 2025, 1)`)
	if err != nil {
		t.Fatal(err)
	}

	h.App.Marketdata.TickFeeds(t.Context())

	got := queryStrings(t, h, `SELECT identifier || ' ' || year || ' ' || shares
		FROM marketdata_company_share_count ORDER BY 1`)
	want := []string{"84429695000111 2026 4197317998", "KEPT 2025 1"}

	if asJSON(t, got) != asJSON(t, want) {
		t.Fatalf("share counts = %v, want %v", got, want)
	}

	got = queryStrings(t, h, `SELECT code || ' ' || shares_per_unit
		FROM marketdata_company_listing ORDER BY 1`)
	want = []string{"BNCX4 1", "INDS3 1", "WEGE3 1"}

	if asJSON(t, got) != asJSON(t, want) {
		t.Fatalf("listings = %v, want %v", got, want)
	}
}

func companyFigureHarness(t *testing.T) *apitest.Harness {
	t.Helper()

	h := apitest.New(t, apitest.Today("2026-11-01"))
	def := mxrf11()
	def["code"], def["type"] = "COMX3", "stock"
	h.MustDo(http.MethodPost, "/api/v1/instruments", def, http.StatusCreated, nil)
	h.SeedCompany(t, "COMX3", companyX)

	return h
}

func companyCounts(year, shares string) map[string]string {
	const header = "CNPJ_Companhia;Data_Referencia;Versao;ID_Documento;Nome_Companhia;" +
		"ID_Capital_Social;Tipo_Capital;Data_Autorizacao_Aprovacao;Valor_Capital;" +
		"Prazo_Integralizacao;Quantidade_Acoes_Ordinarias;Quantidade_Acoes_Preferenciais;" +
		"Quantidade_Total_Acoes"

	return map[string]string{
		"fre_cia_aberta_capital_social_" + year + ".csv": header + "\n" + companyLine(
			companyWEG, year+"-12-31", "1", "1", "WEG S.A.", "1", "Capital Integralizado",
			year+"-04-01", "10.00", "", shares, "0", shares) + "\n",
	}
}
