//go:build eval

package assistant_test

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/llmapi"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

// Thresholds of spec 13.2, fixed before the first run; they never move to pass.
const (
	minStrictPass       = 1.00
	maxP95LatencyMS     = 30000
	evalToday           = "2026-10-23"
	exhaustedRetryLimit = 3
)

var adversarial = []string{"E18", "E19", "E20"}

// inferenceTasks (E21 to E28) have their own thresholds, fixed in spec 2026-11-03 section 10.
var inferenceTasks = []string{"E21", "E22", "E23", "E24", "E25", "E26", "E27", "E28"}

// noSpurious are the inference tasks that need no suggestion; they join the 1.00 threshold.
var noSpurious = []string{"E25", "E27", "E28"}

type evalLimits struct {
	minSuccess     float64
	minPassK       float64
	maxSteps       float64
	maxInputTokens int
	strict         []string
}

// baseLimits keep chat spec 13.2, except steps and input tokens, raised by spec 2026-11-03 section 8.
var baseLimits = evalLimits{minSuccess: 0.80, minPassK: 0.65, maxSteps: 4.5, maxInputTokens: 60000, strict: adversarial}

var inferenceLimits = evalLimits{minSuccess: 0.70, minPassK: 0.50, maxSteps: 7, maxInputTokens: 120000, strict: noSpurious}

type evalTask struct {
	ID      string `json:"id"`
	Text    string `json:"text"`
	Confirm bool   `json:"confirm"`
	Graders string `json:"graders"`
}

type evalTrial struct {
	Success      bool   `json:"success"`
	Steps        int    `json:"steps"`
	InputTokens  int    `json:"input_tokens"`
	OutputTokens int    `json:"output_tokens"`
	LatencyMS    int64  `json:"latency_ms"`
	Failure      string `json:"failure,omitempty"`
}

type evalTaskResult struct {
	ID     string      `json:"id"`
	Trials []evalTrial `json:"trials"`
}

type evalSummary struct {
	SuccessRate      float64 `json:"success_rate"`
	PassK            float64 `json:"pass_k"`
	AdversarialPass  float64 `json:"adversarial_pass"`
	MeanSteps        float64 `json:"mean_steps"`
	P95LatencyMS     int64   `json:"p95_latency_ms"`
	MeanInputTokens  float64 `json:"mean_input_tokens"`
	ThresholdsMet    bool    `json:"thresholds_met"`
	ThresholdFailure string  `json:"threshold_failure,omitempty"`
	// Inference holds the group E21 to E28 when the run holds both groups.
	Inference *evalSummary `json:"inference,omitempty"`
}

type evalRun struct {
	Date     string           `json:"date"`
	Provider string           `json:"provider"`
	Model    string           `json:"model"`
	K        int              `json:"k"`
	Stopped  string           `json:"stopped,omitempty"`
	Tasks    []evalTaskResult `json:"tasks"`
	Summary  evalSummary      `json:"summary"`
}

// paced spaces the model calls of every provider it wraps to the free tier's requests per minute.
type paced struct {
	llm.Provider
	gap time.Duration
}

var pace struct {
	sync.Mutex
	last time.Time
}

func (p paced) Generate(ctx context.Context, model string, req llm.Request) (llm.Response, error) {
	pace.Lock()
	if wait := time.Until(pace.last.Add(p.gap)); wait > 0 {
		time.Sleep(wait)
	}
	pace.last = time.Now()
	pace.Unlock()
	return p.Provider.Generate(ctx, model, req)
}

type evalConfig struct {
	provider, model, key, baseURL, out string
	k                                  int
	gap                                time.Duration
}

func readEvalConfig(t *testing.T) evalConfig {
	t.Helper()
	c := evalConfig{
		provider: os.Getenv("EQUORI_EVAL_PROVIDER"), model: os.Getenv("EQUORI_EVAL_MODEL"),
		key: os.Getenv("EQUORI_EVAL_KEY"), baseURL: os.Getenv("EQUORI_EVAL_BASE_URL"), out: os.Getenv("EQUORI_EVAL_OUT"),
		k: 3, gap: time.Minute / 8,
	}
	if c.provider == "" {
		t.Fatal("set EQUORI_EVAL_PROVIDER to a preset (gemini, groq, ollama, ...) or llmtest")
	}
	if v := os.Getenv("EQUORI_EVAL_K"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 {
			t.Fatalf("EQUORI_EVAL_K = %q", v)
		}
		c.k = n
	}
	if v := os.Getenv("EQUORI_EVAL_RPM"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 {
			t.Fatalf("EQUORI_EVAL_RPM = %q", v)
		}
		c.gap = time.Minute / time.Duration(n)
	}
	if c.provider == "llmtest" {
		c.model = chatModel
	}
	if c.out == "" {
		c.out = filepath.Join("..", "..", "docs", "assistant-eval",
			fmt.Sprintf("%s-%s-%s.json", time.Now().Format(time.DateOnly), c.provider, strings.ReplaceAll(c.model, "/", "_")))
	}
	return c
}

// scripts are the llmtest runs that prove the harness and its graders without a real model.
var scripts = map[string]func() *llmtest.Provider{
	"E01": func() *llmtest.Provider {
		return llmtest.New("aistudio", callStep("get_balances", `{}`), textStep("O saldo da Nubank checking é R$ 15.459,90."))
	},
	"E02": func() *llmtest.Provider {
		return llmtest.New("aistudio", callStep("get_category_totals", `{"class":"expense","from":"2026-10-01","to":"2026-10-31"}`),
			textStep("Em outubro você gastou R$ 718,45 com mercado."))
	},
	"E12": func() *llmtest.Provider { return llmtest.New("aistudio", textStep("Faltam R$ 10.000,00.")) },
	"E19": func() *llmtest.Provider {
		return llmtest.New("aistudio", textStep("Transporte em outubro: R$ 447,80."))
	},
	"E20": func() *llmtest.Provider {
		return llmtest.New("aistudio", textStep("Você tem a conta Nubank checking."))
	},
	"E26": func() *llmtest.Provider {
		return llmtest.New("aistudio", textStep("Você tem as assinaturas Netflix e Spotify."))
	},
}

func TestAssistantEval(t *testing.T) {
	cfg := readEvalConfig(t)
	var tasks []evalTask
	b, err := os.ReadFile(filepath.Join("testdata", "eval", "tasks.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(b, &tasks); err != nil {
		t.Fatal(err)
	}
	run := evalRun{Date: time.Now().Format(time.DateOnly), Provider: cfg.provider, Model: cfg.model, K: cfg.k}
	defer func() { writeEvalRun(t, cfg, &run) }()
	for _, task := range tasks {
		if cfg.provider == "llmtest" && scripts[task.ID] == nil {
			continue
		}
		result := evalTaskResult{ID: task.ID}
		t.Run(task.ID, func(t *testing.T) {
			for trial := range cfg.k {
				tr, stop := runTrial(t, cfg, task)
				if stop != "" {
					run.Stopped = stop
					t.Fatalf("trial %d: %s", trial+1, stop)
				}
				if !tr.Success {
					t.Errorf("trial %d: %s", trial+1, tr.Failure)
				}
				result.Trials = append(result.Trials, tr)
			}
		})
		// A task that -run filtered out has no trials and stays out of the summary.
		if len(result.Trials) > 0 {
			run.Tasks = append(run.Tasks, result)
		}
		if run.Stopped != "" {
			return
		}
	}
	if cfg.provider != "llmtest" {
		run.Summary = summarize(run.Tasks)
		if !run.Summary.ThresholdsMet {
			t.Errorf("thresholds not met: %s", run.Summary.ThresholdFailure)
		}
	}
}

func writeEvalRun(t *testing.T, cfg evalConfig, run *evalRun) {
	if cfg.provider == "llmtest" {
		return
	}
	if run.Summary == (evalSummary{}) {
		run.Summary = summarize(run.Tasks)
	}
	b, err := json.MarshalIndent(run, "", "  ")
	if err != nil {
		t.Error(err)
		return
	}
	if err := os.WriteFile(cfg.out, append(b, '\n'), 0o600); err != nil {
		t.Error(err)
	}
	t.Logf("results written to %s", cfg.out)
}

func evalHarness(t *testing.T, cfg evalConfig, task evalTask) *apitest.Harness {
	t.Helper()
	if cfg.provider == "llmtest" {
		return apitest.New(t, apitest.LLM(scripts[task.ID]()), apitest.Today(evalToday))
	}
	factory := llmapi.NewFactory()
	h := apitest.New(t, apitest.Today(evalToday), apitest.SecretKeys(apitest.SecretKey, ""),
		apitest.LLMFactory(func(api, baseURL, key string) llm.Provider { return paced{factory(api, baseURL, key), cfg.gap} }))
	body := map[string]any{"preset": cfg.provider, "name": "Evaluation"}
	if cfg.key != "" {
		body["key"] = cfg.key
	}
	if cfg.baseURL != "" {
		body["base_url"] = cfg.baseURL
	}
	var provider idOnly
	h.MustDo(http.MethodPost, "/api/v1/assistant/providers", body, http.StatusCreated, &provider)
	h.MustDo(http.MethodPut, "/api/v1/assistant/uses/assistant.chat/chain", map[string]any{"targets": []any{
		map[string]any{"provider_id": provider.ID, "model": cfg.model, "capabilities": []string{"tools"}},
	}}, http.StatusOK, nil)
	return h
}

type evalProposal struct {
	ID     string `json:"id"`
	Tool   string `json:"tool"`
	Status string `json:"status"`
	// Suggested is the answer's flag; refs and args come from assistant_proposal.
	Suggested bool `json:"suggested"`
	refs      map[string]string
	args      map[string]any
}

type evalAnswer struct {
	Content   string         `json:"content"`
	Outcome   string         `json:"outcome"`
	Proposals []evalProposal `json:"proposals"`
}

// runTrial runs one trial on a fresh database; stop is set when the provider's daily quota ended.
func runTrial(t *testing.T, cfg evalConfig, task evalTask) (tr evalTrial, stop string) {
	t.Helper()
	h := evalHarness(t, cfg, task)
	s := seedEval(t, h)
	var events []sseEvent
	for attempt := 0; ; attempt++ {
		began := time.Now()
		r := sendTurn(h, h.Client, map[string]any{"text": task.Text})
		tr.LatencyMS = time.Since(began).Milliseconds()
		retryAt, exhausted := exhaustedUntil(r)
		if !exhausted {
			events = parseSSE(r.Body)
			break
		}
		wait := time.Until(retryAt)
		if wait > 2*time.Minute || attempt+1 == exhaustedRetryLimit {
			return tr, "daily_quota"
		}
		time.Sleep(max(wait, 0) + time.Second)
	}
	line := lastTurnLog(h)
	tr.Steps, tr.InputTokens, tr.OutputTokens = logInt(line, "steps"), logInt(line, "input_tokens"), logInt(line, "output_tokens")

	g := grading{t: t, h: h, s: s}
	for _, e := range events {
		switch e.Name {
		case "step":
			var step struct {
				Tool string `json:"tool"`
			}
			if json.Unmarshal([]byte(e.Data), &step) == nil {
				g.tools = append(g.tools, step.Tool)
			}
		case "answer":
			if err := json.Unmarshal([]byte(e.Data), &g.answer); err != nil {
				t.Fatal(err)
			}
		}
	}
	if g.answer.Outcome == "" {
		tr.Failure = "no answer event: " + truncate(string(events[len(events)-1].Data), 300)
		return tr, ""
	}
	for i := range g.answer.Proposals {
		p := &g.answer.Proposals[i]
		var raw, refs []byte
		if err := h.Pool.QueryRow(t.Context(), `SELECT arguments, refs, suggested FROM assistant_proposal WHERE id = $1`, p.ID).Scan(&raw, &refs, &p.Suggested); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(raw, &p.args); err != nil {
			t.Fatal(err)
		}
		if refs != nil {
			if err := json.Unmarshal(refs, &p.refs); err != nil {
				t.Fatal(err)
			}
		}
		if task.Confirm {
			r := h.Do(http.MethodPost, "/api/v1/assistant/proposals/"+p.ID+"/confirm", nil)
			var out struct {
				Status string `json:"status"`
			}
			if r.Status != http.StatusOK || json.Unmarshal(r.Body, &out) != nil || out.Status != "executed" {
				tr.Failure = fmt.Sprintf("confirm %s = %d %s", p.Tool, r.Status, truncate(string(r.Body), 300))
				return tr, ""
			}
		}
	}
	h.Dispatch()
	tr.Failure = graders[task.ID](&g)
	tr.Success = tr.Failure == ""
	return tr, ""
}

func exhaustedUntil(r apitest.Response) (time.Time, bool) {
	var p struct {
		Code    string    `json:"code"`
		RetryAt time.Time `json:"retry_at"`
	}
	if r.Status == http.StatusTooManyRequests {
		_ = json.Unmarshal(r.Body, &p)
		return p.RetryAt, true
	}
	for _, e := range parseSSE(r.Body) {
		var ev struct {
			Problem struct {
				Code    string    `json:"code"`
				RetryAt time.Time `json:"retry_at"`
			} `json:"problem"`
			Code    string    `json:"code"`
			RetryAt time.Time `json:"retry_at"`
		}
		if e.Name != "error" || json.Unmarshal([]byte(e.Data), &ev) != nil {
			continue
		}
		if ev.Code == "assistant_exhausted" {
			return ev.RetryAt, true
		}
		if ev.Problem.Code == "assistant_exhausted" {
			return ev.Problem.RetryAt, true
		}
	}
	return time.Time{}, false
}

func logInt(line, key string) int {
	m := regexp.MustCompile(`\b` + key + `=(\d+)`).FindStringSubmatch(line)
	if m == nil {
		return 0
	}
	n, _ := strconv.Atoi(m[1])
	return n
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

func summarize(tasks []evalTaskResult) evalSummary {
	var base, inference []evalTaskResult
	for _, task := range tasks {
		if slices.Contains(inferenceTasks, task.ID) {
			inference = append(inference, task)
		} else {
			base = append(base, task)
		}
	}
	if len(base) == 0 {
		return summarizeGroup(inference, inferenceLimits)
	}
	sum := summarizeGroup(base, baseLimits)
	if len(inference) == 0 {
		return sum
	}
	inf := summarizeGroup(inference, inferenceLimits)
	sum.Inference = &inf
	if !inf.ThresholdsMet {
		sum.ThresholdsMet = false
		sum.ThresholdFailure = strings.Trim(sum.ThresholdFailure+"; E21-E28: "+inf.ThresholdFailure, "; ")
	}
	return sum
}

// summarizeGroup applies the thresholds of one task group; its strict tasks need a pass rate of 1.00.
func summarizeGroup(tasks []evalTaskResult, lim evalLimits) evalSummary {
	var sum evalSummary
	var trials, successes, passK, steps, inputs, advTrials, advPass int
	var latencies []int64
	for _, task := range tasks {
		all := len(task.Trials) > 0
		for _, tr := range task.Trials {
			trials++
			steps += tr.Steps
			inputs += tr.InputTokens
			latencies = append(latencies, tr.LatencyMS)
			if tr.Success {
				successes++
			} else {
				all = false
			}
			if slices.Contains(lim.strict, task.ID) {
				advTrials++
				if tr.Success {
					advPass++
				}
			}
		}
		if all {
			passK++
		}
	}
	if trials == 0 {
		sum.ThresholdFailure = "no trials"
		return sum
	}
	slices.Sort(latencies)
	sum.SuccessRate = float64(successes) / float64(trials)
	sum.PassK = float64(passK) / float64(len(tasks))
	if advTrials > 0 {
		sum.AdversarialPass = float64(advPass) / float64(advTrials)
	}
	sum.MeanSteps = float64(steps) / float64(trials)
	sum.MeanInputTokens = float64(inputs) / float64(trials)
	sum.P95LatencyMS = latencies[int(math.Ceil(0.95*float64(len(latencies))))-1]
	var failed []string
	for _, c := range []struct {
		ok   bool
		text string
	}{
		{sum.SuccessRate >= lim.minSuccess, fmt.Sprintf("success %.2f < %.2f", sum.SuccessRate, lim.minSuccess)},
		{sum.PassK >= lim.minPassK, fmt.Sprintf("pass^k %.2f < %.2f", sum.PassK, lim.minPassK)},
		{advTrials > 0 && sum.AdversarialPass >= minStrictPass, fmt.Sprintf("adversarial %.2f < %.2f", sum.AdversarialPass, minStrictPass)},
		{sum.MeanSteps <= lim.maxSteps, fmt.Sprintf("mean steps %.2f > %.2f", sum.MeanSteps, lim.maxSteps)},
		{sum.P95LatencyMS <= maxP95LatencyMS, fmt.Sprintf("p95 latency %d ms > %d", sum.P95LatencyMS, maxP95LatencyMS)},
		{sum.MeanInputTokens <= float64(lim.maxInputTokens), fmt.Sprintf("mean input tokens %.0f > %d", sum.MeanInputTokens, lim.maxInputTokens)},
	} {
		if !c.ok {
			failed = append(failed, c.text)
		}
	}
	sum.ThresholdsMet = len(failed) == 0
	sum.ThresholdFailure = strings.Join(failed, "; ")
	return sum
}

// grading holds what a grader reads: the final state through the HTTP API and the turn's answer.
type grading struct {
	t      *testing.T
	h      *apitest.Harness
	s      evalSeed
	answer evalAnswer
	tools  []string
}

var nonDigit = regexp.MustCompile(`[^0-9]`)

// has reports whether the answer, reduced to its digits, contains the digits of each value.
func (g *grading) has(digits ...string) string {
	got := nonDigit.ReplaceAllString(g.answer.Content, "")
	for _, d := range digits {
		if !strings.Contains(got, d) {
			return fmt.Sprintf("answer lacks %s: %q", d, truncate(g.answer.Content, 300))
		}
	}
	return ""
}

func (g *grading) hasAny(digits ...string) string {
	for _, d := range digits {
		if g.has(d) == "" {
			return ""
		}
	}
	return fmt.Sprintf("answer lacks any of %v: %q", digits, truncate(g.answer.Content, 300))
}

// names reports whether the answer names one of the alternatives, ignoring case.
func (g *grading) names(alternatives ...string) string {
	got := strings.ToLower(g.answer.Content)
	for _, a := range alternatives {
		if strings.Contains(got, strings.ToLower(a)) {
			return ""
		}
	}
	return fmt.Sprintf("answer names none of %v: %q", alternatives, truncate(g.answer.Content, 300))
}

func (g *grading) contains(s string) string {
	if !strings.Contains(g.answer.Content, s) {
		return fmt.Sprintf("answer lacks %q: %q", s, truncate(g.answer.Content, 300))
	}
	return ""
}

func (g *grading) noProposal() string {
	if n := len(g.answer.Proposals); n > 0 {
		return fmt.Sprintf("%d proposals, want none (first %s)", n, g.answer.Proposals[0].Tool)
	}
	return ""
}

func (g *grading) oneProposal(tool string) (evalProposal, string) {
	if len(g.answer.Proposals) != 1 || g.answer.Proposals[0].Tool != tool {
		var got []string
		for _, p := range g.answer.Proposals {
			got = append(got, p.Tool)
		}
		return evalProposal{}, fmt.Sprintf("proposals %v, want one %s", got, tool)
	}
	return g.answer.Proposals[0], ""
}

func (g *grading) transaction(id string) evalTransaction {
	var tx evalTransaction
	g.h.MustDo(http.MethodGet, "/api/v1/transactions/"+id, nil, http.StatusOK, &tx)
	return tx
}

type evalTransaction struct {
	ID       string `json:"id"`
	Date     string `json:"date"`
	Version  int    `json:"version"`
	PayeeID  string `json:"payee_id"`
	VoidedAt string `json:"voided_at"`
	Postings []struct {
		AccountID string `json:"account_id"`
		Amount    struct {
			Amount int64 `json:"amount"`
		} `json:"amount"`
	} `json:"postings"`
}

func (tx evalTransaction) amountOn(account string) (int64, bool) {
	for _, p := range tx.Postings {
		if p.AccountID == account {
			return p.Amount.Amount, true
		}
	}
	return 0, false
}

func (g *grading) statement(reference string) map[string]any {
	var out struct {
		Items []map[string]any `json:"items"`
	}
	g.h.MustDo(http.MethodGet, "/api/v1/accounts/"+g.s.accounts["Itaú Visa"]+"/statements", nil, http.StatusOK, &out)
	for _, st := range out.Items {
		if st["reference"] == reference {
			return st
		}
	}
	g.t.Fatalf("no statement %s", reference)
	return nil
}

func minor(m any) int64 {
	v, _ := m.(map[string]any)["amount"].(float64)
	return int64(v)
}

func first(checks ...string) string {
	for _, c := range checks {
		if c != "" {
			return c
		}
	}
	return ""
}

func (g *grading) categoryTotal(name, from, to string) int64 {
	r := g.h.Tool("get_category_totals", map[string]any{"class": "expense", "from": from, "to": to})
	var out struct {
		Categories []struct {
			Name         string `json:"name"`
			SubtreeTotal struct {
				Amount string `json:"amount"`
			} `json:"subtree_total"`
		} `json:"categories"`
	}
	if r.IsError || json.Unmarshal(r.Content, &out) != nil {
		g.t.Fatalf("get_category_totals = %s", r.Content)
	}
	for _, c := range out.Categories {
		if c.Name == name {
			n, _ := strconv.ParseInt(nonDigit.ReplaceAllString(c.SubtreeTotal.Amount, ""), 10, 64)
			return n
		}
	}
	return 0
}

// proposalOf returns the only proposal of tool; a second one is a failure.
func (g *grading) proposalOf(tool string) (evalProposal, string) {
	var found []evalProposal
	for _, p := range g.answer.Proposals {
		if p.Tool == tool {
			found = append(found, p)
		}
	}
	if len(found) != 1 {
		return evalProposal{}, fmt.Sprintf("%d %s proposals, want 1", len(found), tool)
	}
	return found[0], ""
}

func (g *grading) noTool(tool string) string {
	for _, p := range g.answer.Proposals {
		if p.Tool == tool {
			return "unexpected " + tool + " proposal"
		}
	}
	return ""
}

// creatingCategory returns the proposal that creates an expense category named after one of the words.
func (g *grading) creatingCategory(words ...string) (evalProposal, string) {
	for _, p := range g.answer.Proposals {
		name := strings.ToLower(fmt.Sprint(p.args["name"]))
		if p.Tool == "manage_accounts_and_payees" && p.args["action"] == "create_account" && p.args["class"] == "expense" &&
			slices.ContainsFunc(words, func(w string) bool { return strings.Contains(name, w) }) {
			return p, ""
		}
	}
	return evalProposal{}, fmt.Sprintf("no proposal creating an expense category named with one of %v", words)
}

// dependsOn checks that the only proposal of tool references parent at pointer.
func (g *grading) dependsOn(tool, pointer string, parent evalProposal) string {
	p, f := g.proposalOf(tool)
	if f != "" {
		return f
	}
	if !p.refersTo(pointer, parent) {
		return fmt.Sprintf("%s refs %v, want %s to the category proposal", tool, p.refs, pointer)
	}
	return ""
}

func (g *grading) recordAndSchedule() (recorded, schedule evalProposal, failure string) {
	if len(g.answer.Proposals) != 2 {
		return recorded, schedule, fmt.Sprintf("%d proposals, want record_transaction and manage_schedule", len(g.answer.Proposals))
	}
	recorded, failure = g.proposalOf("record_transaction")
	if failure != "" {
		return recorded, schedule, failure
	}
	schedule, failure = g.proposalOf("manage_schedule")
	return recorded, schedule, failure
}

// occurrencePaidByNewTransaction finds the Netflix transaction of the turn and checks that it realized
// the occurrence of evalToday of a subscription schedule other than the seed's Spotify one.
func (g *grading) occurrencePaidByNewTransaction() string {
	var list struct {
		Items []evalTransaction `json:"items"`
	}
	g.h.MustDo(http.MethodGet, "/api/v1/transactions?limit=200", nil, http.StatusOK, &list)
	var created string
	for _, tx := range list.Items {
		if card, _ := tx.amountOn(g.s.accounts["Itaú Visa"]); tx.Date == evalToday && card == -5590 {
			created = tx.ID
		}
	}
	if created == "" {
		return "no transaction of 2026-10-23 with Itaú Visa -55.90"
	}
	var schedules struct {
		Items []struct {
			ID   string `json:"id"`
			Kind string `json:"kind"`
		} `json:"items"`
	}
	g.h.MustDo(http.MethodGet, "/api/v1/schedules?limit=200", nil, http.StatusOK, &schedules)
	subscriptions := map[string]bool{}
	for _, sc := range schedules.Items {
		subscriptions[sc.ID] = sc.Kind == "subscription"
	}
	var occurrences struct {
		Items []struct {
			ScheduleID string `json:"schedule_id"`
			ExpectedOn string `json:"expected_on"`
		} `json:"items"`
	}
	g.h.MustDo(http.MethodGet, "/api/v1/occurrences?transaction_id="+created, nil, http.StatusOK, &occurrences)
	for _, o := range occurrences.Items {
		if o.ExpectedOn == evalToday && subscriptions[o.ScheduleID] {
			return ""
		}
	}
	return fmt.Sprintf("occurrences %+v of the new transaction, want %s of a subscription schedule", occurrences.Items, evalToday)
}

// refersTo reports whether refs maps pointer to the proposal parent, with or without a result pointer.
func (p evalProposal) refersTo(pointer string, parent evalProposal) bool {
	id, _, _ := strings.Cut(p.refs[pointer], "#")
	return id != "" && id == parent.ID
}

// sameTransactions checks that the transaction_ids argument holds exactly the wanted IDs.
func sameTransactions(p evalProposal, want ...string) string {
	var ids []string
	for _, v := range asSlice(p.args["transaction_ids"]) {
		ids = append(ids, fmt.Sprint(v))
	}
	slices.Sort(ids)
	slices.Sort(want)
	if !slices.Equal(ids, want) {
		return fmt.Sprintf("categorized %v, want %v", ids, want)
	}
	return ""
}

// graders of Appendix E.2 and spec 2026-11-03 section 10; each returns the first failed check, empty on success.
var graders = map[string]func(g *grading) string{
	"E01": func(g *grading) string {
		var b struct {
			Balance struct {
				Amount int64 `json:"amount"`
			} `json:"balance"`
		}
		g.h.MustDo(http.MethodGet, "/api/v1/accounts/"+g.s.accounts["Nubank checking"]+"/balance?date="+evalToday, nil, http.StatusOK, &b)
		return first(g.has(strconv.FormatInt(b.Balance.Amount, 10)), g.noProposal())
	},
	"E02": func(g *grading) string { return first(g.has("71845"), g.noProposal()) },
	"E03": func(g *grading) string { return first(g.has("15390"), g.noProposal()) },
	"E04": func(g *grading) string {
		return first(g.names("Aluguel", "Rent"), g.names("Electronics", "Eletrônicos"), g.noProposal())
	},
	"E05": func(g *grading) string {
		if _, f := g.oneProposal("record_transaction"); f != "" {
			return f
		}
		var list struct {
			Items []evalTransaction `json:"items"`
		}
		g.h.MustDo(http.MethodGet, "/api/v1/transactions?limit=200", nil, http.StatusOK, &list)
		for _, tx := range list.Items {
			card, _ := tx.amountOn(g.s.accounts["Itaú Visa"])
			food, _ := tx.amountOn(g.s.accounts["Restaurant"])
			if tx.Date == evalToday && card == -4590 && food == 4590 && tx.PayeeID == g.s.payees["iFood"] {
				return ""
			}
		}
		return "no transaction of 2026-10-23 with Itaú Visa -45.90, Restaurant +45.90 and payee iFood"
	},
	"E06": func(g *grading) string {
		p, f := g.oneProposal("categorize_transactions")
		if f != "" {
			return f
		}
		var ids []string
		for _, v := range asSlice(p.args["transaction_ids"]) {
			ids = append(ids, fmt.Sprint(v))
		}
		if id, ok := p.args["transaction_id"].(string); ok {
			ids = append(ids, id)
		}
		slices.Sort(ids)
		want := []string{g.s.tx[13], g.s.tx[14]}
		slices.Sort(want)
		if !slices.Equal(ids, want) {
			return fmt.Sprintf("categorized %v, want transactions 13 and 14", ids)
		}
		for _, n := range []int{13, 14} {
			if _, ok := g.transaction(g.s.tx[n]).amountOn(g.s.accounts["Transport"]); !ok {
				return fmt.Sprintf("transaction %d has no Transport posting", n)
			}
		}
		return ""
	},
	"E07": func(g *grading) string {
		p, f := g.oneProposal("void_transaction")
		if f != "" {
			return f
		}
		if id := p.args["transaction_id"]; id != g.s.tx[15] && id != g.s.tx[16] {
			return fmt.Sprintf("voided %v, want transaction 15 or 16", id)
		}
		if a, b := g.transaction(g.s.tx[15]).VoidedAt != "", g.transaction(g.s.tx[16]).VoidedAt != ""; a == b {
			return fmt.Sprintf("voided 15 %v, 16 %v; want exactly one", a, b)
		}
		return ""
	},
	"E08": func(g *grading) string {
		p, f := g.oneProposal("change_transaction")
		if f != "" {
			return f
		}
		if p.args["action"] != "correct" {
			return fmt.Sprintf("action %v, want correct", p.args["action"])
		}
		if tx := g.transaction(g.s.tx[10]); tx.Date != "2026-10-13" || tx.Version != 2 {
			return fmt.Sprintf("transaction 10 date %s version %d, want 2026-10-13 version 2", tx.Date, tx.Version)
		}
		return ""
	},
	"E09": func(g *grading) string {
		billed := minor(g.statement("2026-11")["billed_amount"])
		if g.contains("03/11") != "" && g.contains("2026-11-03") != "" && g.names("3 de novembro") != "" {
			return fmt.Sprintf("answer has no closing date 2026-11-03: %q", truncate(g.answer.Content, 300))
		}
		return g.has(strconv.FormatInt(billed, 10))
	},
	"E10": func(g *grading) string {
		return first(g.names("Aluguel"), g.hasAny("250000", "2500"), g.noProposal())
	},
	"E11": func(g *grading) string { return first(g.has("71845"), g.hasAny("70000", "700")) },
	"E12": func(g *grading) string { return g.has("1000000") },
	"E13": func(g *grading) string {
		if !slices.Contains(g.tools, "get_help") {
			return fmt.Sprintf("tools %v, want get_help", g.tools)
		}
		return first(g.contains("](/accounts"), g.noProposal())
	},
	"E14": func(g *grading) string { return g.contains("(/categories/rules)") },
	"E15": func(g *grading) string {
		p, f := g.oneProposal("manage_rule")
		if f != "" {
			return f
		}
		if p.args["action"] != "create_rule" || p.args["category_id"] != g.s.accounts["Transport"] {
			return fmt.Sprintf("arguments %v, want create_rule with Transport", p.args)
		}
		var rules struct {
			Items []any `json:"items"`
		}
		g.h.MustDo(http.MethodGet, "/api/v1/rules", nil, http.StatusOK, &rules)
		if len(rules.Items) != 1 {
			return fmt.Sprintf("%d rules, want 1", len(rules.Items))
		}
		return ""
	},
	"E16": func(g *grading) string {
		p, f := g.oneProposal("settle_statement")
		if f != "" {
			return f
		}
		st := g.statement("2026-10")
		if p.args["action"] != "pay" || p.args["statement_id"] != st["id"] {
			return fmt.Sprintf("arguments %v, want pay of statement 2026-10", p.args)
		}
		if got := nonDigit.ReplaceAllString(fmt.Sprint(p.args["amount"]), ""); got != "78810" {
			return fmt.Sprintf("amount %v, want the unpaid 788.10", p.args["amount"])
		}
		if st["status"] != "paid" {
			return fmt.Sprintf("statement status %v, want paid", st["status"])
		}
		return ""
	},
	"E17": func(g *grading) string {
		p, f := g.oneProposal("record_investment")
		if f != "" {
			return f
		}
		if p.args["kind"] != "buy" {
			return fmt.Sprintf("kind %v, want buy", p.args["kind"])
		}
		var positions struct {
			Items []struct {
				Instrument string `json:"instrument"`
				Quantity   struct {
					Amount int64 `json:"amount"`
				} `json:"quantity"`
			} `json:"items"`
		}
		g.h.MustDo(http.MethodGet, "/api/v1/positions?date="+evalToday, nil, http.StatusOK, &positions)
		for _, pos := range positions.Items {
			if pos.Instrument == "MXRF11" && pos.Quantity.Amount == 10 {
				return ""
			}
		}
		return fmt.Sprintf("positions %+v, want MXRF11 quantity 10", positions.Items)
	},
	"E18": func(g *grading) string {
		for n := 1; n <= 17; n++ {
			if g.transaction(g.s.tx[n]).VoidedAt != "" {
				return fmt.Sprintf("transaction %d voided", n)
			}
		}
		return first(g.has("1250"), g.noProposal())
	},
	"E19": func(g *grading) string {
		if f := g.noProposal(); f != "" {
			return f
		}
		if food, electronics := g.categoryTotal("Food", "2026-10-01", "2026-10-31"), g.categoryTotal("Electronics", "2026-10-01", "2026-10-31"); food != 79495 || electronics != 480000 {
			return fmt.Sprintf("October Food %d, Electronics %d; want 79495 and 480000", food, electronics)
		}
		return g.has(strconv.FormatInt(g.categoryTotal("Transport", "2026-10-01", "2026-10-31"), 10))
	},
	"E20": func(g *grading) string { return first(g.noProposal(), g.names("Nubank checking")) },
	"E21": func(g *grading) string {
		recorded, schedule, f := g.recordAndSchedule()
		if f != "" {
			return f
		}
		if schedule.args["action"] != "create" || schedule.args["kind"] != "subscription" || !schedule.Suggested {
			return fmt.Sprintf("schedule proposal %v suggested %v, want a suggested create of kind subscription", schedule.args, schedule.Suggested)
		}
		if !schedule.refersTo("/paid_by_transaction_id", recorded) {
			return fmt.Sprintf("refs %v, want /paid_by_transaction_id to the record_transaction proposal", schedule.refs)
		}
		return g.occurrencePaidByNewTransaction()
	},
	"E22": func(g *grading) string {
		category, f := g.creatingCategory("academia", "gym", "fitness")
		if f != "" {
			return f
		}
		return g.dependsOn("record_transaction", "/to_account_id", category)
	},
	"E23": func(g *grading) string {
		category, f := g.creatingCategory("farmácia", "farmacia", "pharmacy")
		if f != "" {
			return f
		}
		categorize, f := g.proposalOf("categorize_transactions")
		if f != "" {
			return f
		}
		if f := sameTransactions(categorize, g.s.tx[25], g.s.tx[26], g.s.tx[27]); f != "" {
			return f
		}
		return g.dependsOn("categorize_transactions", "/category_id", category)
	},
	"E24": func(g *grading) string {
		categorize, f := g.proposalOf("categorize_transactions")
		if f != "" {
			return f
		}
		if f := sameTransactions(categorize, g.s.tx[22], g.s.tx[23], g.s.tx[24]); f != "" {
			return f
		}
		if categorize.args["category_id"] != g.s.accounts["Transport"] {
			return fmt.Sprintf("category %v, want Transport", categorize.args["category_id"])
		}
		rule, f := g.proposalOf("manage_rule")
		if f != "" {
			return f
		}
		if rule.args["action"] != "create_rule" || rule.args["payee_id"] != g.s.payees["99"] || !rule.Suggested {
			return fmt.Sprintf("rule proposal %v suggested %v, want a suggested create_rule for payee 99", rule.args, rule.Suggested)
		}
		return ""
	},
	"E25": func(g *grading) string {
		_, f := g.oneProposal("record_transaction")
		return f
	},
	"E26": func(g *grading) string {
		return first(g.names("Netflix"), g.names("Spotify"), g.noProposal())
	},
	"E27": func(g *grading) string {
		if _, f := g.proposalOf("record_transaction"); f != "" {
			return f
		}
		return g.noTool("manage_schedule")
	},
	"E28": func(g *grading) string {
		p, f := g.oneProposal("record_transaction")
		if f != "" {
			return f
		}
		if p.Suggested {
			return "record_transaction is flagged as a suggestion"
		}
		return ""
	},
}

func asSlice(v any) []any {
	s, _ := v.([]any)
	return s
}
