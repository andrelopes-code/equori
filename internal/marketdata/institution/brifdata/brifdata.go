// Package brifdata reads the prudential indicators the Banco Central do Brasil publishes in
// IF.data, by prudential conglomerate (A237).
package brifdata

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/institution"
)

const (
	portal = "https://www3.bcb.gov.br/ifdata/"
	scheme = "br_ispb"

	// quarters is how many quarter ends a fetch probes, from the latest one on or before today.
	quarters = 8
	decimals = 10
	// prudential is the TipoInstituicao of the conglomerates and the independent institutions.
	prudential = 1
	pageSize   = 20000

	summaryReport = "1"
	capitalReport = "5"
)

// figure is a value read by its Conta; the name guards against a renumbered Conta.
type figure struct {
	conta  string
	prefix string
	report string
	money  bool
}

var figures = []figure{
	{"140246", "Patrimônio Líquido", summaryReport, true},
	{"141870", "Lucro Líquido", summaryReport, true},
	{"79662", "Índice de Imobilização", summaryReport, false},
	{"79664", "Índice de Basileia", summaryReport, false},
	{"79659", "Índice de Capital Principal", capitalReport, false},
}

type Source struct {
	hc   *http.Client
	base string
}

// New reads the Olinda service of IF.data at base.
func New(hc *http.Client, base string) Source { return Source{hc: hc, base: base} }

func (Source) ID() string  { return "br_ifdata" }
func (Source) URL() string { return portal }

// Limits are the floors of Resolução CMN 4.958/2021: 8% of the RWA for the reference capital,
// 4.5% for the principal capital and 2.5% of conservation buffer on top of both minimums.
func (Source) Limits() institution.Limits {
	return institution.Limits{
		Basel:            institution.Floor{Minimum: "0.08", WithBuffer: "0.105"},
		PrincipalCapital: institution.Floor{Minimum: "0.045", WithBuffer: "0.07"},
		Rule:             "Resolução CMN 4.958/2021",
	}
}

func (s Source) Fetch(
	ctx context.Context, today time.Time, have []time.Time,
) (institution.Snapshot, error) {
	latest, err := s.latestPeriod(ctx, today)
	if err != nil {
		return institution.Snapshot{}, err
	}

	register, err := s.cadastro(ctx, latest)
	if err != nil {
		return institution.Snapshot{}, err
	}

	out := institution.Snapshot{Currency: "BRL"}

	for i, period := range keptPeriods(latest) {
		end := periodEnd(period)
		if i > 0 && slices.ContainsFunc(have, end.Equal) {
			continue
		}

		values := map[string]*institution.Figures{}

		for _, report := range []string{summaryReport, capitalReport} {
			if err := s.readReport(ctx, period, report, values); err != nil {
				return institution.Snapshot{}, err
			}
		}

		if len(values) > 0 {
			out.Periods = append(out.Periods, institution.Period{
				End: end, Entries: entries(register, values),
			})
		}
	}

	return out, nil
}

// keptPeriods returns the AnoMes of latest and of the quarters before it, newest first.
func keptPeriods(latest int) []int {
	end := periodEnd(latest)
	out := make([]int, 0, institution.KeptPeriods)

	for range institution.KeptPeriods {
		out = append(out, end.Year()*100+int(end.Month()))
		end = previousQuarterEnd(end)
	}

	return out
}

// periodEnd is the last day of the month an AnoMes names.
func periodEnd(period int) time.Time {
	return time.Date(period/100, time.Month(period%100)+1, 0, 0, 0, 0, 0, time.UTC)
}

type register struct {
	Code         string  `json:"CodInst"`
	Name         string  `json:"NomeInstituicao"`
	Conglomerate *string `json:"CodConglomeradoPrudencial"`
	Status       string  `json:"Situacao"`
}

type value struct {
	Code   string       `json:"CodInst"`
	Conta  string       `json:"Conta"`
	Name   string       `json:"NomeColuna"`
	Amount *json.Number `json:"Saldo"`
}

// latestPeriod returns the AnoMes of the latest quarter end, on or before today, with a row.
func (s Source) latestPeriod(ctx context.Context, today time.Time) (int, error) {
	end := time.Date(today.Year(), (today.Month()-1)/3*3+4, 0, 0, 0, 0, 0, time.UTC)
	if end.After(today) {
		end = previousQuarterEnd(end)
	}

	for range quarters {
		period := end.Year()*100 + int(end.Month())
		q := "$top=1&$select=CodInst&$format=json"

		var doc struct {
			Value []value `json:"value"`
		}

		if err := s.get(ctx, s.values(period, summaryReport)+"?"+q, &doc); err != nil {
			return 0, err
		}

		if len(doc.Value) > 0 {
			return period, nil
		}

		end = previousQuarterEnd(end)
	}

	return 0, fmt.Errorf("br_ifdata: %w", feed.ErrNoData)
}

func previousQuarterEnd(end time.Time) time.Time {
	return time.Date(end.Year(), end.Month()-2, 0, 0, 0, 0, 0, time.UTC)
}

func (s Source) cadastro(ctx context.Context, period int) ([]register, error) {
	q := fmt.Sprintf(
		"$top=%d&$select=CodInst,NomeInstituicao,CodConglomeradoPrudencial,Situacao&$format=json",
		pageSize,
	)

	var doc struct {
		Value []register `json:"value"`
	}

	err := s.get(ctx, fmt.Sprintf("/IfDataCadastro(AnoMes=%d)?%s", period, q), &doc)

	return doc.Value, err
}

// readReport stores into values the figures of report, by institution code.
func (s Source) readReport(
	ctx context.Context, period int, report string, values map[string]*institution.Figures,
) error {
	var wanted []figure

	var contas []string

	for _, f := range figures {
		if f.report == report {
			wanted = append(wanted, f)
			contas = append(contas, "Conta eq '"+f.conta+"'")
		}
	}

	q := "$filter=" + url.PathEscape(strings.Join(contas, " or ")) +
		fmt.Sprintf("&$top=%d&$select=CodInst,Conta,NomeColuna,Saldo&$format=json", pageSize)

	var doc struct {
		Value []value `json:"value"`
	}

	if err := s.get(ctx, s.values(period, report)+"?"+q, &doc); err != nil {
		return err
	}

	for _, v := range doc.Value {
		for _, f := range wanted {
			if v.Conta != f.conta || !strings.HasPrefix(v.Name, f.prefix) || v.Amount == nil {
				continue
			}

			if err := store(values, v, f); err != nil {
				return err
			}
		}
	}

	return nil
}

func store(values map[string]*institution.Figures, v value, f figure) error {
	rat, ok := new(big.Rat).SetString(v.Amount.String())
	if !ok {
		return fmt.Errorf("br_ifdata: %s of %s: %q", f.prefix, v.Code, v.Amount)
	}

	if values[v.Code] == nil {
		values[v.Code] = &institution.Figures{}
	}

	if !f.money {
		ratio := rat.FloatString(decimals)
		assign(values[v.Code], f.conta, &ratio, nil)

		return nil
	}

	// The register states amounts with floating-point noise; FloatString rounds to the nearest
	// cent, halves away from zero.
	cents, ok := new(big.Int).SetString(rat.Mul(rat, big.NewRat(100, 1)).FloatString(0), 10)
	if !ok || !cents.IsInt64() {
		return fmt.Errorf("br_ifdata: %s of %s: %q", f.prefix, v.Code, v.Amount)
	}

	minor := cents.Int64()
	assign(values[v.Code], f.conta, nil, &minor)

	return nil
}

func assign(f *institution.Figures, conta string, ratio *string, minor *int64) {
	switch conta {
	case "140246":
		f.Equity = minor
	case "141870":
		f.NetIncome = minor
	case "79662":
		f.FixedAsset = ratio
	case "79664":
		f.Basel = ratio
	case "79659":
		f.PrincipalCapital = ratio
	}
}

// entries gives each active institution the figures of its conglomerate, or its own.
func entries(rows []register, values map[string]*institution.Figures) []institution.Entry {
	names := make(map[string]string, len(rows))
	for _, r := range rows {
		names[r.Code] = r.Name
	}

	var out []institution.Entry

	seen := map[string]bool{}

	for _, r := range rows {
		key := r.Code
		if r.Conglomerate != nil && *r.Conglomerate != "" {
			key = *r.Conglomerate
		}

		f := values[key]
		if f == nil || r.Status != "A" || !isISPB(r.Code) || seen[r.Code] {
			continue
		}

		seen[r.Code] = true

		name := names[key]
		if name == "" {
			name = key
		}

		out = append(out, institution.Entry{
			Scheme: scheme, Identifier: r.Code,
			ConglomerateCode: key, ConglomerateName: name,
			Figures: *f,
		})
	}

	return out
}

func isISPB(code string) bool {
	if len(code) != 8 {
		return false
	}

	for _, c := range code {
		if c < '0' || c > '9' {
			return false
		}
	}

	return true
}

func (s Source) values(period int, report string) string {
	return fmt.Sprintf(
		"/IfDataValores(AnoMes=%d,TipoInstituicao=%d,Relatorio='%s')", period, prudential, report,
	)
}

func (s Source) get(ctx context.Context, path string, into any) error {
	body, err := feed.Get(ctx, s.hc, s.base+path)
	if err != nil {
		return fmt.Errorf("br_ifdata: %w", err)
	}

	if err := json.Unmarshal(body, into); err != nil {
		return fmt.Errorf("br_ifdata: decode: %w", err)
	}

	return nil
}
