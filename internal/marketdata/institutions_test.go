package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const indicatorsPath = "/api/v1/market-data/institution-indicators"

// Rows of the IF.data service of 2026-11-16, reduced: the period 202609 has no row, 202606 has.
// 18236120 reaches its conglomerate; 00000001 is independent and has a null Basel index.
const (
	ifdataCadastro = `{"value":[
{"CodInst":"18236120","NomeInstituicao":"NU PAGAMENTOS S.A.","CodConglomeradoPrudencial":"C0084693","Situacao":"A"},
{"CodInst":"C0084693","NomeInstituicao":"NU PAGAMENTOS - PRUDENCIAL","CodConglomeradoPrudencial":"C0084693","Situacao":"A"},
{"CodInst":"00000001","NomeInstituicao":"BANCO INDEPENDENTE S.A.","CodConglomeradoPrudencial":null,"Situacao":"A"}]}`

	ifdataSummary = `{"value":[
{"CodInst":"C0084693","Conta":"140246","NomeColuna":"Patrimônio Líquido","Saldo":23344610717.36},
{"CodInst":"C0084693","Conta":"141870","NomeColuna":"Lucro Líquido","Saldo":4093040225.39},
{"CodInst":"C0084693","Conta":"79662","NomeColuna":"Índice de Imobilização \n(p)","Saldo":0.0510180760985693},
{"CodInst":"C0084693","Conta":"79664","NomeColuna":"Índice de Basileia \n(n)","Saldo":0.155091256405038},
{"CodInst":"00000001","Conta":"140246","NomeColuna":"Patrimônio Líquido","Saldo":1000.5},
{"CodInst":"00000001","Conta":"79664","NomeColuna":"Índice de Basileia \n(n)","Saldo":null}]}`

	// The quarter before: Nu Pagamentos with a null Basel index.
	ifdataSummaryMarch = `{"value":[
{"CodInst":"C0084693","Conta":"140246","NomeColuna":"Patrimônio Líquido","Saldo":21000000000.5},
{"CodInst":"C0084693","Conta":"141870","NomeColuna":"Lucro Líquido","Saldo":1420540594.15},
{"CodInst":"C0084693","Conta":"79664","NomeColuna":"Índice de Basileia \n(n)","Saldo":null}]}`

	ifdataCapital = `{"value":[
{"CodInst":"C0084693","Conta":"79659","NomeColuna":"Índice de Capital Principal \n(l)","Saldo":0.117599598739514}]}`
)

type indicators struct {
	Source           string `json:"source"`
	SourceURL        string `json:"source_url"`
	Currency         string `json:"currency"`
	ConglomerateCode string `json:"conglomerate_code"`
	ConglomerateName string `json:"conglomerate_name"`
	Limits           struct {
		Basel            floor  `json:"basel"`
		PrincipalCapital floor  `json:"principal_capital"`
		Rule             string `json:"rule"`
	} `json:"limits"`
	Periods []period `json:"periods"`
}

type floor struct {
	Minimum    string `json:"minimum"`
	WithBuffer string `json:"with_buffer"`
}

type period struct {
	Period           string  `json:"period"`
	Basel            *string `json:"basel"`
	PrincipalCapital *string `json:"principal_capital"`
	FixedAsset       *string `json:"fixed_asset"`
	Equity           *int64  `json:"equity"`
	NetIncome        *int64  `json:"net_income"`
}

// A237 I9, H3. S488, S495, S496.
func TestInstitutionIndicators(t *testing.T) {
	t.Parallel()

	h, _ := ifdataHarness(t, "2026-11-16")
	enableIFData(t, h, true)

	var got indicators
	h.MustDo(http.MethodGet, indicatorsPath+"?scheme=br_ispb&identifier=18236120", nil,
		http.StatusOK, &got)

	if got.Source != "br_ifdata" || got.Currency != "BRL" ||
		got.SourceURL != "https://www3.bcb.gov.br/ifdata/" {
		t.Fatalf("header %+v", got)
	}

	if got.ConglomerateCode != "C0084693" || got.ConglomerateName != "NU PAGAMENTOS - PRUDENCIAL" {
		t.Fatalf("conglomerate %+v", got)
	}

	// S496: the floors of Resolução CMN 4.958/2021.
	if got.Limits.Basel != (floor{"0.08", "0.105"}) ||
		got.Limits.PrincipalCapital != (floor{"0.045", "0.07"}) ||
		got.Limits.Rule != "Resolução CMN 4.958/2021" {
		t.Fatalf("limits %+v", got.Limits)
	}

	// S495: newest first; the null of March stays null.
	if len(got.Periods) != 2 || got.Periods[0].Period != "2026-06-30" ||
		got.Periods[1].Period != "2026-03-31" {
		t.Fatalf("periods %+v", got.Periods)
	}

	june, march := got.Periods[0], got.Periods[1]
	if text(june.Basel) != "0.1550912564" || text(june.PrincipalCapital) != "0.1175995987" ||
		text(june.FixedAsset) != "0.0510180761" {
		t.Fatalf("ratios %v %v %v", june.Basel, june.PrincipalCapital, june.FixedAsset)
	}

	if june.Equity == nil || *june.Equity != 2334461071736 ||
		june.NetIncome == nil || *june.NetIncome != 409304022539 {
		t.Fatalf("amounts %v %v", june.Equity, june.NetIncome)
	}

	if march.Basel != nil || march.Equity == nil || *march.Equity != 2100000000050 ||
		march.NetIncome == nil || *march.NetIncome != 142054059415 {
		t.Fatalf("march %+v", march)
	}
}

// A237 I7. S489.
func TestInstitutionIndicatorsNullIsNotZero(t *testing.T) {
	t.Parallel()

	h, _ := ifdataHarness(t, "2026-11-16")
	enableIFData(t, h, true)

	var got indicators
	h.MustDo(http.MethodGet, indicatorsPath+"?scheme=br_ispb&identifier=00000001", nil,
		http.StatusOK, &got)

	// The independent institution has a row for June only.
	if len(got.Periods) != 1 {
		t.Fatalf("periods %+v", got.Periods)
	}

	p := got.Periods[0]
	if p.Basel != nil || p.PrincipalCapital != nil || p.FixedAsset != nil || p.NetIncome != nil {
		t.Fatalf("figures %+v", p)
	}

	if p.Equity == nil || *p.Equity != 100050 {
		t.Fatalf("equity %v", p.Equity)
	}
}

// A237 I2, I9. S490.
func TestInstitutionIndicatorsFeedDisabled(t *testing.T) {
	t.Parallel()

	h, _ := ifdataHarness(t, "2026-11-16")
	enableIFData(t, h, true)
	enableIFData(t, h, false)

	r := h.Do(http.MethodGet, indicatorsPath+"?scheme=br_ispb&identifier=18236120", nil)
	h.ExpectProblem(r, http.StatusNotFound, "not_found", "")
}

// A237 I9. S491.
func TestInstitutionIndicatorsUnknown(t *testing.T) {
	t.Parallel()

	h, _ := ifdataHarness(t, "2026-11-16")
	enableIFData(t, h, true)

	for name, query := range map[string]string{
		"identifier without a row": "?scheme=br_ispb&identifier=99999999",
		"scheme without a source":  "?scheme=bic&identifier=18236120",
	} {
		t.Run(name, func(t *testing.T) {
			r := h.Do(http.MethodGet, indicatorsPath+query, nil)
			h.ExpectProblem(r, http.StatusNotFound, "not_found", "")
		})
	}

	r := h.Do(http.MethodGet, indicatorsPath+"?identifier=18236120", nil)
	h.ExpectProblem(r, http.StatusBadRequest, "invalid_request", "scheme")
}

// A237 B2. S492.
func TestInstitutionIndicatorsAccess(t *testing.T) {
	t.Parallel()

	h, _ := ifdataHarness(t, "2026-11-16")
	enableIFData(t, h, true)

	member := h.LoginMember("member@example.com")

	r := h.Call(member, http.MethodGet, indicatorsPath+"?scheme=br_ispb&identifier=18236120", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("member = %d: %s", r.Status, r.Body)
	}

	r = h.Call(&http.Client{}, http.MethodGet,
		indicatorsPath+"?scheme=br_ispb&identifier=18236120", nil)
	if r.Status != http.StatusUnauthorized {
		t.Fatalf("no session = %d: %s", r.Status, r.Body)
	}
}

// A237 I2, I8. S493.
func TestInstitutionFeedState(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		today string
		stale bool
	}{
		{"2026-11-16", false},
		{"2027-01-28", false},
		{"2027-01-29", true},
	} {
		t.Run(tc.today, func(t *testing.T) {
			h, _ := ifdataHarness(t, tc.today)
			enableIFData(t, h, true)

			var list struct {
				Items []struct {
					ID      string  `json:"id"`
					Kind    string  `json:"kind"`
					Enabled bool    `json:"enabled"`
					Last    *string `json:"last"`
					Stale   bool    `json:"stale"`
				} `json:"items"`
			}
			h.MustDo(http.MethodGet, "/api/v1/market-data/feeds", nil, http.StatusOK, &list)

			for _, f := range list.Items {
				if f.ID != "br_ifdata" {
					continue
				}

				if f.Kind != "institution" || !f.Enabled || f.Last == nil ||
					*f.Last != "2026-06-30" || f.Stale != tc.stale {
					t.Fatalf("feed %+v last %v", f, f.Last)
				}

				return
			}

			t.Fatal("br_ifdata is not listed")
		})
	}
}

// A237 X2. S494: a book of another region suggests no IF.data feed.
func TestInstitutionFeedNotSuggestedOutsideBrazil(t *testing.T) {
	t.Parallel()

	h, _ := ifdataHarness(t, "2026-11-16")

	us := h.LoginAs("us@example.com", locale.Locale{Language: "en", Region: "US"}, "USD")

	var list struct {
		Items []struct {
			ID        string `json:"id"`
			Suggested bool   `json:"suggested"`
		} `json:"items"`
	}

	r := h.Call(us, http.MethodGet, "/api/v1/market-data/feeds", nil)
	r.Decode(t, &list)

	for _, f := range list.Items {
		if f.ID == "br_ifdata" && f.Suggested {
			t.Fatal("br_ifdata is suggested to a US book")
		}
	}
}

// A237 H1. S497: a second tick reads no stored period again; the latest one it reads again.
func TestInstitutionTickReadsNewPeriodsOnly(t *testing.T) {
	t.Parallel()

	h, log := ifdataHarness(t, "2026-11-16")
	enableIFData(t, h, true)

	march := log.count("AnoMes=202603")
	june := log.count("IfDataValores(AnoMes=202606")

	h.App.Marketdata.TickFeeds(t.Context())

	if got := log.count("AnoMes=202603"); got != march {
		t.Fatalf("March requests %d, then %d", march, got)
	}

	if got := log.count("IfDataValores(AnoMes=202606"); got <= june {
		t.Fatalf("June requests %d, then %d", june, got)
	}
}

// A237 H1. S498: the table keeps the eight latest quarters.
func TestInstitutionTickKeepsEightQuarters(t *testing.T) {
	t.Parallel()

	quarters := []string{
		"AnoMes=202606", "AnoMes=202603", "AnoMes=202512", "AnoMes=202509",
		"AnoMes=202506", "AnoMes=202503", "AnoMes=202412", "AnoMes=202409", "AnoMes=202406",
	}
	h, _ := ifdataHarnessOf(t, "2026-11-16", quarters...)

	if _, err := h.Pool.Exec(
		t.Context(),
		`INSERT INTO marketdata_institution_indicator `+
			`(scheme, identifier, source, period, currency, conglomerate_code, conglomerate_name) `+
			`VALUES ('br_ispb', '18236120', 'br_ifdata', '2024-06-30', 'BRL', 'C0084693', 'NU')`,
	); err != nil {
		t.Fatal(err)
	}

	enableIFData(t, h, true)

	var got indicators
	h.MustDo(http.MethodGet, indicatorsPath+"?scheme=br_ispb&identifier=18236120", nil,
		http.StatusOK, &got)

	if len(got.Periods) != 8 || got.Periods[0].Period != "2026-06-30" ||
		got.Periods[7].Period != "2024-09-30" {
		t.Fatalf("periods %+v", got.Periods)
	}
}

// hits records the Olinda requests of a harness.
type hits struct {
	mu    sync.Mutex
	paths []string
}

func (h *hits) add(path string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.paths = append(h.paths, path)
}

func (h *hits) count(part string) int {
	h.mu.Lock()
	defer h.mu.Unlock()

	n := 0

	for _, p := range h.paths {
		if strings.Contains(p, part) {
			n++
		}
	}

	return n
}

func ifdataHarness(t *testing.T, today string) (*apitest.Harness, *hits) {
	t.Helper()

	return ifdataHarnessOf(t, today, "AnoMes=202606", "AnoMes=202603")
}

// ifdataHarnessOf serves the cadastro of 2026-06 and a summary for each listed period: the first
// is the June one, any other the March one.
func ifdataHarnessOf(t *testing.T, today string, periods ...string) (*apitest.Harness, *hits) {
	t.Helper()

	log := &hits{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, top := r.URL.Path, r.URL.Query().Get("$top")
		log.add(path)

		switch {
		case strings.Contains(path, "IfDataCadastro") && strings.Contains(path, periods[0]):
			_, _ = w.Write([]byte(ifdataCadastro))
		case strings.Contains(path, "IfDataValores") && strings.Contains(path, periods[0]) &&
			strings.Contains(path, "Relatorio='1'") && top == "1":
			_, _ = w.Write([]byte(`{"value":[{"CodInst":"C0084693"}]}`))
		case strings.Contains(path, "Relatorio='1'") && strings.Contains(path, periods[0]):
			_, _ = w.Write([]byte(ifdataSummary))
		case strings.Contains(path, "Relatorio='5'") && strings.Contains(path, periods[0]):
			_, _ = w.Write([]byte(ifdataCapital))
		case strings.Contains(path, "Relatorio='1'") && inAny(path, periods[1:]):
			_, _ = w.Write([]byte(ifdataSummaryMarch))
		default:
			_, _ = w.Write([]byte(`{"value":[]}`))
		}
	}))
	t.Cleanup(srv.Close)

	return apitest.New(
		t,
		apitest.Today(today),
		apitest.IndexFeeds(nil, map[string]string{"br_ifdata": srv.URL}),
	), log
}

func inAny(path string, parts []string) bool {
	for _, p := range parts {
		if strings.Contains(path, p) {
			return true
		}
	}

	return false
}

func enableIFData(t *testing.T, h *apitest.Harness, enabled bool) {
	t.Helper()

	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/br_ifdata",
		map[string]bool{"enabled": enabled},
		http.StatusOK,
		nil,
	)
	h.App.Marketdata.TickFeeds(t.Context())
}

func text(s *string) string {
	if s == nil {
		return "<nil>"
	}

	return *s
}
