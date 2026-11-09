# Feature design checklist

Every spec answers each question below in a section named "Cross-cutting questions", one line per ID. A line holds the answer, or "Does not apply:" followed by the reason. A change without a spec answers the questions in its plan; a change without a plan answers them in the issue before the first commit.

The plan check (`docs/contributing/agents.md`, step 3) rejects a spec or plan with an ID missing. The review (step 5) checks that each answer has its test.

## Regions and languages

| ID | Question | Source |
|---|---|---|
| R1 | Which values vary by country: currency, calendar, index, tax rule, identifier scheme, aggregator, word, number or date format? Each one names its extension point: a case of `<module>/region_defaults.go` or a registry entry. | ADR 016, `docs/contributing/regions.md` |
| R2 | What does the feature do in a region without an implementation? The answer names the neutral value or the neutral behavior. | CONTRIBUTING, Regions |
| R3 | Does a value set grow with regions? It is `^[a-z0-9_]{2,40}$` in SQL and a `pattern` in `api/openapi.yaml`, never an `IN` or an `enum`. | CONTRIBUTING, Regions |
| R4 | Does the feature add an extension point? It adds its row to `docs/contributing/regions.md` in the same change. | CONTRIBUTING, Regions |
| R5 | Which texts does the feature add? Each one has a catalog key with pt-BR and en text. | Vision 1.11.1, Languages |
| R6 | Which numbers and dates does the screen write? Each one takes its format from the active tag through `Intl`. | `docs/contributing/web.md`, O10 |

## Currencies

| ID | Question | Source |
|---|---|---|
| C1 | Which amounts does the feature store or compute? Each one is an integer of minor units with its currency, never a `float64`. | ADR 005; `docs/contributing/currencies.md`, M1 |
| C2 | Does the feature add or compare amounts? A sum holds one currency. A figure across currencies names the conversion: the date of the rate, the rate source and the state shown when a rate is missing. A missing rate is stated on screen, never read as zero and never dropped in silence. | ADR 005; owner, 2026-11-09; `docs/contributing/currencies.md`, M2 to M8, M10 |
| C3 | What does the feature show when the book's base currency is not the currency of the account, the instrument or the index it reads? | ADR 005; `docs/contributing/currencies.md`, M9 |
| C4 | Where does a displayed currency come from? From the record or from settings, never from a literal fallback. An amount on screen goes through `useMoneyFormat()`, so privacy mode hides it. | `docs/contributing/web.md`, O9 and O10; ADR 018; `docs/contributing/currencies.md`, M11, M12 |

## Time

| ID | Question | Source |
|---|---|---|
| T1 | Which dates does the feature use? A date is a calendar date in the book's time zone; "today" comes from `platform/clock`. | ADR 005, section 3 |
| T2 | Does the feature count business days or depend on a closing or due date? The calendar comes from the region's calendar registry. | ADR 016 |

## Books, members and access

| ID | Question | Source |
|---|---|---|
| B1 | Does the feature add a table? It holds `books_id`, every query on it filters by `books_id`, and a schema test rejects a row without a book. | ADR 003, ADR 029 |
| B2 | Which role does each new operation need: `owner`, `write` or `read`? The operation declares it in `x-book-role` and an HTTP test covers each role and an access without membership. | ADR 029 |
| B3 | Does the feature add a setting? It lives at one level: instance, book, member or browser. Only values needed before the database opens, security boundaries and host or network values live in the environment. | Vision 1.11.1, Settings |

## Data lifecycle

| ID | Question | Source |
|---|---|---|
| D1 | Does the feature add a table? The export classifies it as a fact, as shared or as left out (`TestEveryTableIsClassified`). A change of the archive format raises the archive version. | ADR 021 |
| D2 | Does the feature change the schema? A new goose migration; an applied migration is never edited. | CONTRIBUTING, Pull requests |
| D3 | Does the feature change a recorded fact? The change is traceable: a version of the transaction or an automatic decision with its undo. | Vision G8 |
| D4 | Does the feature write data from a bank, a file or a model? equori decides alone only when a rule leaves no doubt; every other case waits for review. Importing the same input twice creates nothing. | Vision 1.11.1, Changed bank data; SC2 |
| D5 | Does the feature add a field to the diagnostic file? The file holds no amount, name or description. | `docs/specs/2026-10-31-protected-data-design.md` |

## Surfaces

| ID | Question | Source |
|---|---|---|
| S1 | Which operations does the feature add to `api/openapi.yaml`? Each one has an entry in `internal/server/tool_exposure_test.go`: the assistant and MCP tools that cover it, or an exclusion. Each new `Problem.code` has a test through the HTTP API. | ADR 012, ADR 024, CONTRIBUTING |
| S2 | Does the feature appear on a phone? The answer follows the phone scope. | ADR 027, `docs/contributing/mobile.md` |
| S3 | Does the feature change what a user can do on a screen? The guide article of that screen's topic changes in the same commit. | CONTRIBUTING, Code |
| S4 | Does the assistant need the feature's data in its context or in a tool? | ADR 012, ADR 020 |

## Tests

| ID | Question | Source |
|---|---|---|
| X1 | Which scenarios of `docs/domain/06-scenarios.md` does the feature add? Each one has an ID and a test through `internal/apitest` that carries it. | CONTRIBUTING, Tests |
| X2 | When R1, R2 or C2 to C3 apply: which test runs outside Brazil, and which test runs with a base currency other than the account's? | Owner, 2026-11-09 |
