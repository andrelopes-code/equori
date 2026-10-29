# Assistant evaluation

`TestAssistantEval` (`internal/assistant/eval_test.go`, build tag `eval`) runs the 20 tasks of `internal/assistant/testdata/eval/tasks.json` against a real language model. Each trial seeds a fresh database with the fixture of `internal/assistant/evalseed_test.go`, configures the provider through the HTTP API, sends the task's message, confirms the answer's proposals when the task says so, and grades the answer and the final state in code. Design: spec 13.2 of `docs/specs/2026-10-23-assistant-chat-design.md`.

## Run

```sh
EQUORI_EVAL_PROVIDER=gemini EQUORI_EVAL_MODEL=gemini-3.5-flash-lite EQUORI_EVAL_KEY=<key> \
  go test -tags eval -run TestAssistantEval -timeout 90m ./internal/assistant/
```

| Variable | Meaning | Default |
|---|---|---|
| `EQUORI_EVAL_PROVIDER` | Preset of `listPresets` (`gemini`, `groq`, `ollama`, ...), or `llmtest` for the scripted tasks that prove the harness | required |
| `EQUORI_EVAL_MODEL` | Model of the provider | required |
| `EQUORI_EVAL_KEY` | API key of the provider | none |
| `EQUORI_EVAL_BASE_URL` | Base URL, for `ollama` or `custom` | the preset's |
| `EQUORI_EVAL_K` | Trials per task | 3 |
| `EQUORI_EVAL_RPM` | Model requests per minute across the run | 8 |
| `EQUORI_EVAL_OUT` | Result file | `docs/assistant-eval/<date>-<provider>-<model>.json` |

The tests need the test database (`make db-up`) and `EQUORI_TEST_DATABASE_URL`, as `make test` sets it. A task runs one trial at a time; `-run TestAssistantEval/E05` runs one task. An exhausted quota whose return is more than two minutes away stops the run and writes the partial file with `"stopped": "daily_quota"`.

## Thresholds

Fixed before the first run (spec 13.2); a failed threshold changes descriptions, schemas, the catalog or the prompt, never the threshold.

| Measure | Threshold |
|---|---|
| Task success over all trials | ≥ 0.80 |
| pass^k: tasks whose every trial succeeds | ≥ 0.65 |
| Adversarial tasks E18–E20 | 1.00 |
| Mean model steps per trial | ≤ 3.5 |
| p95 turn latency | ≤ 30 s |
| Mean input tokens per trial | ≤ 40,000 |

## Results

| Date | Provider | Model | k | Success | pass^k | Adversarial | Mean steps | p95 latency | Mean input tokens | Thresholds met |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-23 | gemini (free tier) | gemini-3.5-flash-lite | 3 | 0.98 | 0.95 | 1.00 | 2.73 | 27.7 s | 35,179 | yes |

In the run of 2026-10-23, E17 was re-run on 2026-10-24 after a grader fix; the file's `notes` says so. The one failed trial, E14 trial 3, linked to `/categories/rules/rules`, a path outside the navigation map that the panel renders as text.
