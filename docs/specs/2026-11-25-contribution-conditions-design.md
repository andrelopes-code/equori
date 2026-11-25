# Contribution plan: conditions, reminders and the criteria panel

- Date: 2026-11-25
- Status: approved on 2026-11-25
- Module: `portfolio`, `marketdata`; rules CO1 to CO17; scenarios S720 to S736
- Mock: approved on 2026-11-25, `docs/superpowers/mocks/2026-11-25-contribution-conditions-design/` (local)
- Amends: `docs/specs/2026-11-12-contribution-plan-design.md` (CN1, CN7, CN8, CN17, CN18, This month), `docs/specs/2026-11-18-contribution-questions-design.md` (CQ2, CQ3), `docs/specs/2026-11-22-contribution-fact-questions-design.md` (FQ4), `docs/specs/2026-11-23-contribution-criteria-design.md` (AC10, AC11, AC16, Screen: Criteria section, Purchase list, Criteria board)

## Intent

The owner buys a bitcoin ETF only while the market falls and is in fear (2026-11-25). A criterion of today cannot hold a purchase: it divides the amount of a group among its assets (CQ3), so in a group of one asset "sim" and "não" give the same purchase. An answer has no date, so nothing states that it was given months ago. The board that edits the criteria cuts the question in a field of 221 px for a text of 367 px, marks an answer by a cell that toggles, and needs an edit mode.

The owner asked for: the money of a held group to go to the other groups, never to stay idle; criteria that are reviewed each month beside others reviewed each quarter or year; a pleasant screen; interaction on the main screen of the plan; no rigid rule and no obstacle for the users (stated three times); the Crypto Fear & Greed Index as an option only.

## Goals, non-goals, anti-goals

Goals:

- A criterion has one of three effects: it only warns, it holds the purchase, or it weighs in the division (today's effect).
- The money of a held asset goes to the other assets of its group, then to the other groups.
- An own answer has a date and an optional reminder, in months.
- One press buys a held asset for the month, and one press takes that back.
- A panel beside the purchase list answers and edits the criteria. No edit mode, no save bar, no board.
- The Crypto Fear & Greed Index is an automatic criterion a user may add.

Non-goals:

- A stored history of answers or contributions. equori records no contribution, so "this time" is the calendar month.
- A limit or a criterion shipped or suggested by equori (owner, 2026-11-18, issue #60).
- A drawdown criterion: ABTC11 has prices since 2026-07-15 only.
- A combination of conditions other than "each one that holds must be met".
- A notification of a reminder outside the plan screen.
- A phone layout (ADR 027).

Anti-goals:

- A question without an answer, an expired answer, an index without data or an incomplete criterion that holds a purchase.
- A reminder that blocks the list, its copy or the save of the plan.
- A contribution that stays without a destination because every asset is held.
- A word, a colour or an order that reads an index or an answer as a recommendation.

## Evidence

- The index is served by `https://api.alternative.me/fng/`, free, commercial use allowed with attribution beside the data. 3,216 daily points since 2018-02-01, read on 2026-11-25.
- 753 of 3,216 days (23.4%) are at 25 or below. 26 of 106 month ends are. The longest run of months without one has 25 months.
- The searches of 2026-11-25 found no study that supports buying at extreme fear; one supports momentum (virtusinterpress, cocv21i2art10, abstract). The criterion is therefore the user's rule, as AC states for valuation.

## Rules

### Criterion

**CO1 Effect.** A question has an effect: `warn`, `hold` or `weigh`. An absent effect is `weigh`, the effect of every stored question. A criterion added on the screen starts as `warn`.

**CO2 Counting criterion.** A criterion with a limit key and no limit is stored and counts for nothing: no point, no hold, no warning; its fact answer is `none` with reason `no_limit`. A limit outside its range still returns `contribution_question_invalid` (AC11). A text stays 1 to 200 characters, unique in its group (CQ1).

**CO3 Answer.** The stored answer of a member is one of: none; `yes` or `no`; `na` ("não se aplica"). An answer has the date it was given; an answer stored before this spec has no date. An answer to a question with a fact is an override or a fallback.

| State | `answers` | `answer_dates` | `answer_overrides` |
|---|---|---|---|
| no answer | null | null | false |
| yes or no | true or false | a date, or null for an older answer | true over a fact, else false |
| not applicable | null | a date | true over a fact, else false |

**CO4 Effective answer (amends FQ4).** An override applies. Without one, the fact answer applies when it is `yes` or `no`. Else the stored answer applies. An own question accepts a null answer (amends CQ2).

**CO5 Points (amends CQ3).** Only counting criteria of effect `weigh` give points. A member without an effective answer to a question with a fact, and without an override there, has no points and takes the equal share of CQ3. An own question without an answer, and an answer `na`, give no point and change nothing else. A group derives ideals only when it has a counting criterion of effect `weigh`; any other group keeps its typed ideals, or none, beside its criteria.

**CO6 Held member.** A member is held when the effective answer to one counting criterion of effect `hold` is `no`, and the member is not released (CO8).

**CO7 Reminder.** An own question has a reminder of 0, 1, 3, 6 or 12 months; 0, the default, is none. An answer is due when the calendar months from the month of its date to the month of today are at least the reminder; an answer `yes` or `no` without a date is due. A question without an answer is never due. A due answer keeps counting.

**CO8 Release.** A member may be released for the calendar month of today. The release ends with the month. It never changes an answer.

### Split

**CO9 Held slots (amends CN7, CN8).** In the split, a held member has ideal 0 among the members of its group, and a held group has ideal 0 among the groups. Values stay. A group is held when every member of positive ideal is held, or, without ideals, when every member is. Shares, drift and the bars of the ideal read the true ideals.

**CO10 Group of one.** A group with one member and no ideal is split and ordered as a group whose member has ideal 10000. Its `target_bp` stays absent.

**CO11 Undivided group.** A group of two or more members without ideals that is not held receives its amount undivided; the row names its held members ("menos ABTC11").

**CO12 Leftover (amends CN18).** A held entry has weight 0 in CN18, so no step reaches it.

**CO13 Everything held.** When no group keeps a positive ideal in the split, the holds are ignored for the split and the response says `holds_ignored`.

**CO14 Amount given up.** The preview computes the split without holds too. `forgone` of a held member (of a held group, when undivided) is its part there.

**AC16 amended.** The guarantee holds over the groups of positive ideal in the split; a held group receives nothing.

### Save

**CO15 Revision.** The plan has a revision, 0 without a plan, raised by one per save. A `PUT` with a `revision` that differs from the stored one returns 409 `contribution_plan_changed` and stores nothing. A `PUT` without it is stored as today. The screen saves each change of a criterion with the whole plan and the revision it read. On 409 it reads the plan again and applies the change again once; when the criterion, the group or the asset is gone, or a second 409 comes, it states that the plan changed and shows the plan read. A save that fails keeps the typed text and offers to retry.

**CO16 Dates.** `answer_dates` is optional. Present, it is stored, a date after today as today. Absent, an answer equal to the stored one of the same group name, question text and member keeps its date, and any other answer takes today's. The editor of groups and the assistant therefore change no date of an answer they do not change. `question_effects`, `question_reviews`, `answer_overrides` and `released`, absent, are kept for the same group name, question text and member, else take the default. The match ignores case.

### Crypto Fear & Greed

**CO17 Index.** Registry of sentiment sources in `marketdata`, first source `alternative_me` (index `crypto_fear_greed`, whole values 0 to 100, one a day, not regional). It is a feed of ADR 025: off by default, in no `SuggestedFeeds`, `official` true. The tick reads it only when the feed is on and one question of the instance names the fact `crypto_fear_greed_max` (port `SentimentDemand`, wired in `internal/server`). The first read asks for the whole series; the next ones for the days after the latest. A value outside 0 to 100, a repeated day or a day later than today in UTC fails the fetch. The fact key `crypto_fear_greed_max` holds when the index is at most the limit, whole, 0 to 100. It reads the latest value, at most 3 days older than today, for every member, accounts included; older, reason `stale`; without one, `no_index`; with the feed off, `index_off`. AC13 does not apply to it. Attribution "alternative.me" stands beside the value.

## Hand-computed cases

Each is a test of the domain function.

- Groups 5000, 3000, 2000 of value zero, 1,000.00. None held: 500.00, 300.00, 200.00. Third held: 625.00, 375.00, 0; `forgone` 200.00.
- CN14 with 1,500.00 and foreign stocks held: domestic stocks rise to 20,000 for 1,000.00; domestic and real estate funds then share 500.00 equally: 0, 1,250.00, 0, 250.00; `forgone` 1,500.00.
- Group with X 6000 and Y 4000, values zero, part 1,000.00, X held: 0, 1,000.00; `forgone` of X 600.00. Both held: the group is held.
- X 10000 and Y 0, X held: the group is held.
- Every group held: the split of CN7, `holds_ignored` true.
- Share A held, unit 10.00; share B planned 1,000.00, unit 150.00: B 6 shares (900.00), A none, leftover 100.00.
- Reminder 1: answered 2026-10-31, today 2026-11-01: due. Answered 2026-10-01, today 2026-10-31: not due. Reminder 3: answered 2026-09-30: due on 2026-12-01, not on 2026-11-30. Reminder 12 without a date, answer no: due. No answer: not due. Reminder 0 without a date: not due.
- Released in 2026-11: held again on 2026-12-01.
- Effective answer: fact `yes`, override `no`: no. Fact `yes`, fallback `no`: yes. Fact `none`, fallback `no`: no. Fact `no`, override `na`: not held.
- Points: own question without an answer and one `yes`: 1 point. Fact `none` without an answer: no points, equal share. The same with override `na`: 0 points, no equal share. Effect `warn` with `yes`: 0 points and typed ideals kept.
- `crypto_fear_greed_max` 25: value 25 `yes`, 26 `no`; value of 4 days ago `none`, `stale`; limit 25.5 or 101 `contribution_question_invalid`; no limit `none`, `no_limit`.

## API

| Operation | Change |
|---|---|
| `getContributionPlan`, `previewContributionPlan`, `saveContributionPlan` | The plan gains `revision`, `holds_ignored`. A class gains `question_effects`, `question_reviews`, `held`, `forgone`. A member gains `answer_dates`, `answer_overrides`, `released`, `held`, `held_by` (positions of the criteria that answer no), `warned_by`, `due` (positions), `forgone`; a field of a member that is false or empty is absent. The input gains `revision`, `question_effects` (`warn`, `hold`, `weigh`), `question_reviews` (0, 1, 3, 6, 12), `answer_dates`, `answer_overrides`, `released`. A list whose length differs from the questions, or an unknown value, returns `contribution_question_invalid` or `contribution_answers_invalid` |
| `getSentimentIndex`, `GET /sentiment-indexes/{id}`, `read` | `id`, `enabled`, latest `value` and `date`, `since`, `days`, `counts` (101 integers, days per value). Unknown id: 404 `not_found` |

The screen computes "{n}% dos dias" from `counts`.

## Storage

One migration per module change:

- `portfolio_contribution_plan`: `revision bigint NOT NULL DEFAULT 1`.
- `portfolio_contribution_question`: `effect text NOT NULL DEFAULT 'weigh'` with a check of the three values, `review_months smallint NOT NULL DEFAULT 0` with a check of the five.
- `portfolio_contribution_answer`: `answered_on date NULL`, `overrides boolean NOT NULL DEFAULT false`.
- `portfolio_contribution_member`: `release_month date NULL`, check of the first day of a month.
- `marketdata_sentiment (index_id, date, value smallint 0 to 100, source)`, key of the first two, instance market data.

The revision is read and raised in the transaction of the save, under a lock of the plan row. The save deletes and inserts the plan row today; it updates it instead.

## Screen

The approved mock is the contract of layout, sizes and states; this section holds the behavior. Vocabulary as AC.

### Purchase list

- It lists every asset of the plan: "Comprar agora", the leftover, "Esperando" (held assets), "Sem compra neste mês". A group by rule or undivided is one row. Without an amount, or with a missing price, the rows stay without amounts, so the criteria stay reachable.
- A row opens the panel beside the list; the row chosen, or close, or Escape closes it. Focus goes to the panel title and back to the row.
- The panel opens by itself at the first load only, on the first asset that waits, else on the first with a due answer; otherwise the list keeps the whole width.
- With the panel closed a row holds code, group, a bar of its share, order, cost, share. With the panel open it holds two lines without the group name. The last place of a row shows, in order of priority, "revisar", "só este mês", "aviso" or the share. When `holds_ignored`, it shows "esperaria" and a sentence above the list says that the contribution was divided without the conditions.
- "Revisar {n} respostas" in the header of "Este mês" opens the next asset with a due answer; it is absent without one. It never blocks.
- The sentence "Aplique R$ … em n compras", the section "Critérios dos ativos" and the board leave.

### Panel

- Head: asset, group, close. With two or more assets in the group, a choice "Só {asset}" or "Os {n} ativos".
- Verdict: "Espera neste mês" with `forgone` and "Comprar mesmo assim"; "Liberado só neste mês" with "Voltar a esperar"; "Liberado"; "Compra normal, com aviso"; "Compra normal" with points and ideal; "Sem critério".
- One asset: each criterion with its text at full length, the answer (Sim, Não, Não se aplica), the date, "Hora de revisar" when due, effect and reminder in one line. Pressing the chosen answer again, or "Continua valendo" beside "Hora de revisar", renews its date. An automatic criterion shows the answer, the figure and the date; the index shows its scale.
- The group: one criterion open at a time, one row per asset with its ideal; the closed ones state the counts.
- "Editar" opens the criterion in place: text, effect, reminder, limit, answer (with "Automático" for a fact), "Remover critério". A field saves when it loses focus or on Enter, a choice when chosen. Escape restores the field. A blank text returns to the stored one. A value out of range is marked and not sent; the rest is saved. Every removal and change of effect shows "Desfazer", which saves the plan of before.
- "Adicionar critério": one text field and the automatic criteria that apply to an asset of the group, then "Ver todos"; with two or more assets, "Entra nos {n} ativos do grupo". Company criteria are named as not applicable when no member has a report.
- Adding the index as an admin with the feed off turns the feed on (`setMarketDataFeed`), then adds the criterion. For another member, the criterion is added and says that an administrator turns the source on in settings.
- The limit of the index starts empty. The scale is a slider with keyboard (arrows 1, Page 10, Home, End) and a number field.
- Facts of the asset at the foot: "Lucro no ano" with "Ver demonstrações", "Ver informe", "Comparar indexadores", "Reservado para {goal}". They replace the column and the links of the purchase list.
- A change to `weigh` on a group with typed ideals states that the criteria set the ideals from now on. Removing the last such criterion writes the derived ideals as typed.
- A member without the `write` role reads the panel: no control, no "Editar". Privacy mode hides the amounts.
- A group by rule has the panel with its facts and the line that its assets are chosen by rule.

### Editing groups and targets

"Editar grupos e ideais" keeps its draft, save bar and leave dialog. The panel is closed while it is open. A group that derives ideals shows them read-only with "definido pelos critérios".

## Cross-cutting questions

- R1: The index, its scale and its source are not regional. Nothing else varies by country.
- R2: Does not apply: no regional behavior; a region sees the same index.
- R3: Fact keys, reasons and sentiment index ids are `^[a-z0-9_]{2,40}$`, a `pattern` in the API. Effects and reminder months do not grow with regions.
- R4: A row "Sentiment source" in `docs/contributing/regions.md`.
- R5: Keys `contributionPlan.panel.*`, `contributionPlan.effect.*`, `contributionPlan.review.*`, `contributionPlan.list.*`, `marketData.feed.alternative_me`, problem text of `contribution_plan_changed`, pt-BR and en. The keys of the board leave.
- R6: Amounts through `useMoneyFormat`, counts and percents through `numberFormatter`, dates through `formatDate`.
- C1: `forgone` is an integer of minor units of the base currency. Index values are integers.
- C2: The split sums amounts of the base currency, as CN5. No new conversion.
- C3: The index is a pure number. The plan stays in the base currency.
- C4: `forgone` carries the currency of the book and goes through `useMoneyFormat`.
- T1: Dates of answers and the month of a release are of the book's time zone, from `platform/clock`. The date of an index value is its UTC date.
- T2: Does not apply: no business day.
- B1: No table with `books_id` is added; the new columns belong to tables that have it. `marketdata_sentiment` is instance market data. Schema tests reject an unknown effect, 2 months, a release of day 2 and an index value of 101.
- B2: `getSentimentIndex` needs `read`; the plan operations keep their roles. HTTP tests cover a member, a reader that writes (403), an access without membership and no session.
- B3: No setting; the feed is the instance setting of ADR 025. The open panel is not stored.
- D1: The new columns are facts of the book; `ArchiveVersion` rises by one and its step fills the defaults. `marketdata_sentiment` is left out: a tick writes it again.
- D2: New goose migrations.
- D3: The plan is replaced whole by each save (CN1); the revision stops a save over an unread one.
- D4: The index is public data keyed by day; the same fetch twice writes nothing.
- D5: Does not apply.
- S1: `getSentimentIndex` in `tool_exposure_test.go`, covered by `get_market_data` view `sentiment`. `contribution_plan_changed` has an HTTP test.
- S2: Does not apply: the plan is desktop only (ADR 027).
- S3: `contribution_plan.md` of the guide, the help page in pt and en and its figures through `tools/help-media`, in the commit of the screen; `settings_language_and_region.md` for the feed.
- S4: `get_portfolio` view `contribution` and `save_contribution_plan` carry the new fields.
- X1: S720 a hold sends the money to the other groups. S721 a hold inside a group. S722 a member without an answer is not held. S723 an incomplete criterion is stored and counts for nothing. S724 release, its end at the month's turn, and its undo. S725 every group held. S726 the leftover skips a held asset. S727 due answers, and a due answer still counts. S728 a save without `answer_dates` keeps the dates of unchanged answers. S729 409 on an old revision, nothing stored. S730 override of a fact. S731 typed ideals beside a `hold` criterion. S732 an archive of version 35 is restored with effect `weigh`. S733 the index is not read without a question that names it. S734 the index answers `yes`, `no` and `stale`. S735 `save_contribution_plan` with effects returns the plan of S720. S736 a book of region `US` with base `USD` gives the split of S720 and the answer of S734.
- X2: S736 runs outside Brazil with a base currency other than the one of ABTC11.

## Approaches

For the hold:

1. Type the ideal of the group as 0 in the months to wait. Rejected: it loses the ideal, and the drift reads a false target.
2. A minimum of points to buy. Rejected: a threshold is one more rule to learn, and it ties weighing to holding.
3. An effect per criterion. Chosen: today's criteria keep their effect, and a criterion that only warns is the default.

For the screen (mock, two rounds): questions first, by criterion; one list whose rows expand; list and panel side by side. Chosen: the last, by the owner.

For the save of one change:

1. One operation per answer, criterion and release. Rejected: five operations and five tools for a plan already replaced whole.
2. The whole plan with a revision. Chosen: it also protects the editor of groups from an unread save.

## Left to the plan

- The Slotted family or own element of the scale; `slider`, `segmented-control`, `textarea` and `toast` exist in the installed version.
- File split of the panel under the size limits of the project.

## Delivery order

1. Domain, storage, archive, API and tools of effects, dates, reminders, release and revision (CO1 to CO16).
2. List and panel; guide, help and figures; removal of the board.
3. Index: source, storage, operation, criterion, scale in the panel (CO17).
