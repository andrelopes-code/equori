package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
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

	ifdataCapital = `{"value":[
{"CodInst":"C0084693","Conta":"79659","NomeColuna":"Índice de Capital Principal \n(l)","Saldo":0.117599598739514}]}`
)

type indicators struct {
	Source           string  `json:"source"`
	SourceURL        string  `json:"source_url"`
	Period           string  `json:"period"`
	Currency         string  `json:"currency"`
	ConglomerateCode string  `json:"conglomerate_code"`
	ConglomerateName string  `json:"conglomerate_name"`
	Basel            *string `json:"basel"`
	PrincipalCapital *string `json:"principal_capital"`
	FixedAsset       *string `json:"fixed_asset"`
	Equity           *int64  `json:"equity"`
	NetIncome        *int64  `json:"net_income"`
}

// A237 I9. S471.
func TestInstitutionIndicators(t *testing.T) {
	t.Parallel()

	h := ifdataHarness(t, "2026-11-16")
	enableIFData(t, h, true)

	var got indicators
	h.MustDo(http.MethodGet, indicatorsPath+"?scheme=br_ispb&identifier=18236120", nil,
		http.StatusOK, &got)

	if got.Source != "br_ifdata" || got.Period != "2026-06-30" || got.Currency != "BRL" ||
		got.SourceURL != "https://www3.bcb.gov.br/ifdata/" {
		t.Fatalf("header %+v", got)
	}

	if got.ConglomerateCode != "C0084693" || got.ConglomerateName != "NU PAGAMENTOS - PRUDENCIAL" {
		t.Fatalf("conglomerate %+v", got)
	}

	if text(got.Basel) != "0.1550912564" || text(got.PrincipalCapital) != "0.1175995987" ||
		text(got.FixedAsset) != "0.0510180761" {
		t.Fatalf("ratios %v %v %v", got.Basel, got.PrincipalCapital, got.FixedAsset)
	}

	if got.Equity == nil || *got.Equity != 2334461071736 ||
		got.NetIncome == nil || *got.NetIncome != 409304022539 {
		t.Fatalf("amounts %v %v", got.Equity, got.NetIncome)
	}
}

// A237 I7. S472.
func TestInstitutionIndicatorsNullIsNotZero(t *testing.T) {
	t.Parallel()

	h := ifdataHarness(t, "2026-11-16")
	enableIFData(t, h, true)

	var got indicators
	h.MustDo(http.MethodGet, indicatorsPath+"?scheme=br_ispb&identifier=00000001", nil,
		http.StatusOK, &got)

	if got.Basel != nil || got.PrincipalCapital != nil || got.FixedAsset != nil ||
		got.NetIncome != nil {
		t.Fatalf("figures %+v", got)
	}

	if got.Equity == nil || *got.Equity != 100050 {
		t.Fatalf("equity %v", got.Equity)
	}
}

// A237 I2, I9. S473.
func TestInstitutionIndicatorsFeedDisabled(t *testing.T) {
	t.Parallel()

	h := ifdataHarness(t, "2026-11-16")
	enableIFData(t, h, true)
	enableIFData(t, h, false)

	r := h.Do(http.MethodGet, indicatorsPath+"?scheme=br_ispb&identifier=18236120", nil)
	h.ExpectProblem(r, http.StatusNotFound, "not_found", "")
}

// A237 I9. S474.
func TestInstitutionIndicatorsUnknown(t *testing.T) {
	t.Parallel()

	h := ifdataHarness(t, "2026-11-16")
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

// A237 B2. S475.
func TestInstitutionIndicatorsAccess(t *testing.T) {
	t.Parallel()

	h := ifdataHarness(t, "2026-11-16")
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

// A237 I2, I8. S476.
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
			h := ifdataHarness(t, tc.today)
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

// A237 X2. S477: a book of another region suggests no IF.data feed.
func TestInstitutionFeedNotSuggestedOutsideBrazil(t *testing.T) {
	t.Parallel()

	h := ifdataHarness(t, "2026-11-16")

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

func ifdataHarness(t *testing.T, today string) *apitest.Harness {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, top := r.URL.Path, r.URL.Query().Get("$top")

		switch {
		case strings.Contains(path, "AnoMes=202606") && strings.Contains(path, "IfDataCadastro"):
			_, _ = w.Write([]byte(ifdataCadastro))
		case strings.Contains(path, "AnoMes=202606") && strings.Contains(path, "Relatorio='1'") &&
			top == "1":
			_, _ = w.Write([]byte(`{"value":[{"CodInst":"C0084693"}]}`))
		case strings.Contains(path, "AnoMes=202606") && strings.Contains(path, "Relatorio='1'"):
			_, _ = w.Write([]byte(ifdataSummary))
		case strings.Contains(path, "AnoMes=202606") && strings.Contains(path, "Relatorio='5'"):
			_, _ = w.Write([]byte(ifdataCapital))
		default:
			_, _ = w.Write([]byte(`{"value":[]}`))
		}
	}))
	t.Cleanup(srv.Close)

	return apitest.New(
		t,
		apitest.Today(today),
		apitest.IndexFeeds(nil, map[string]string{"br_ifdata": srv.URL}),
	)
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
