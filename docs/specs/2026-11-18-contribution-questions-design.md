# Contribution plan: ideal of each asset from the investor's questions

- Date: 2026-11-18
- Status: approved on 2026-11-18 (the owner delegated the decisions to the planning session)
- Issue: #60
- Amends: `docs/specs/2026-11-12-contribution-plan-design.md` (CN3, CN4, API, Storage, Edit mode)

## Intent

A group of the contribution plan can divide its ideal among its assets (CN4), and the investor types each asset's ideal by hand. Methods taught to Brazilian investors weigh each asset by the answers "yes" to a list of questions the investor keeps. The owner's request of 2026-11-18: questions the investor writes give the ideal of each asset; the screen shows beside the answers the facts of the fund report and of the company report. equori ships no question and judges no answer.

## Goals, non-goals, anti-goals

Goals:

- A group holds up to ten questions of the investor and, for each asset, one answer "sim" or "não" per question.
- The answers give the ideal of each asset inside the group, stored and served as the member ideals of CN4, so the split of the month (CN7 to CN9) and the orders (CN17, CN18) follow them unchanged.
- Beside each asset of such a group, the screen shows the facts of its fund report (#57) or company report (#58) with their date.
- The assistant reads and writes the questions and answers through its tools.

Non-goals:

- A question with a weight, a grade or more than two answers.
- An answer computed by equori from a fact.
- Questions shared by several groups or books.

Anti-goals:

- A question shipped by equori, a template, a suggestion or an example list of questions (owner, 2026-11-18: the list starts empty).
- A colour, an order or a mark that reads an answer or a fact as a buy.

## Rules

**CQ1 Questions.** A group holds an ordered list of zero to ten questions. A question is a text of 1 to 200 characters after trimming, unique in its group ignoring case. Any other list returns `contribution_question_invalid` on the field of the question.

**CQ2 Answers.** In a group with questions, each member carries `answers`: one boolean per question, in the order of the questions, `true` for "sim". A member without `answers`, or with a number of answers different from the number of questions, returns `contribution_answers_invalid`. A member of a group without questions carries no `answers`; one that does returns `contribution_answers_invalid`.

**CQ3 Ideal from the answers.** In a group with questions, a member sent with `target_bp` returns `contribution_answers_invalid`: the ideals are derived. With `s_i` the number of answers `true` of member `i` and `S = Σ s_i`:

- `S > 0`: `t_i = floor(10000 × s_i / S)`; the remaining basis points, fewer than the number of members with `s_i > 0`, go one each to those members in decreasing order of the discarded fraction, ties by position in the group. `Σ t_i = 10000`. A member with `s_i = 0` has ideal 0 (CN7: it receives nothing).
- `S = 0`: the group has no member ideals (CN4, first case): it receives one amount, and the response marks `question_ideals` false.

The derived ideals are what GET, PUT and the preview return as `target_bp`, so every rule after CN4 reads them as typed ideals.

**CQ4 Storage.** `portfolio_contribution_question (books_id, class_id, position int, text text)`, primary key `(class_id, position)`, `(books_id, class_id)` referencing the class with `ON DELETE CASCADE`, `position` 0 to 9, `text` of 1 to 200 characters. `portfolio_contribution_answer (books_id, class_id, question_position, member_position, yes boolean NOT NULL)`, primary key `(class_id, question_position, member_position)`, `(class_id, question_position)` referencing the question and `(class_id, member_position)` referencing the member (`portfolio_contribution_member` has the key `(class_id, position)` and no `id`), both with `ON DELETE CASCADE`. A save replaces the questions and answers with the rest of the plan (CN1). The derived ideals are stored in `portfolio_contribution_member.target_bp` by the same save.

**CQ5 API.** `ContributionClassInput` and `ContributionClass` gain `questions` (array of strings, at most 10); `ContributionMemberInput` and `ContributionMember` gain `answers` (array of booleans). `ContributionClass` gains `question_ideals` (boolean): true when the group has questions and `S > 0`. A group without questions returns `questions` empty and no `answers`. The preview applies CQ1 to CQ3 to the draft.

**CQ6 Tools.** `get_portfolio` view `contribution` returns the questions, the answers and the derived ideals; `save_contribution_plan` accepts `questions` per group and `answers` per member with the rules of CQ1 to CQ3.

**CQ7 Hand-computed cases.** Each is a test of the domain function.

- Three members, three questions, answers (sim, sim, não), (sim, não, não), (não, não, não): `s` 2, 1, 0; `S` 3; `t` 6666, 3333, 0 floors to 9999; the remaining 1 goes to the larger discarded fraction: 6666.67 and 3333.33 discard 0.67 and 0.33, so the first: 6667, 3333, 0.
- Two members, one question, answers (sim), (sim): 5000, 5000.
- Three members, one question, (sim), (sim), (sim): 3333 each floors to 9999; equal fractions, the first by position: 3334, 3333, 3333.
- Two members, two questions, every answer "não": no member ideals, `question_ideals` false.
- A question of 201 characters, an empty question, two questions "Paga dividendos?" and "paga dividendos?", eleven questions: `contribution_question_invalid`.
- A member with two answers in a group of three questions, a member with `target_bp` in a group with questions, a member with `answers` in a group without questions: `contribution_answers_invalid`.

## Screen

### Edit mode, assets panel of a group

The switch "Dividir o ideal do grupo entre os ativos" keeps its place. When it is on, a segmented choice under it reads "Ideal de cada ativo": "Digitado" (the member ideals typed as today) or "Pelas minhas perguntas". Turning to "Pelas minhas perguntas" keeps the assets and starts with no question and every answer "não"; turning back keeps the derived ideals as typed ideals.

With "Pelas minhas perguntas":

- A muted line: "Escreva perguntas de sim ou não. Cada sim soma um ponto ao ativo; o ideal de cada ativo é a sua parte dos pontos do grupo."
- The questions, numbered 1 to 10, each a text field of one line with a remove button; "Adicionar pergunta" adds an empty one, disabled at ten. The list starts empty. No placeholder holds an example question.
- The asset rows, each of fixed height: the asset's name; one checkbox per question, labelled by its number and named for assistive technology by the question's text; "{n} de {m} sim"; the derived ideal "ideal 66,7% do grupo"; and on a second row of fixed height, the facts of the asset (below).
- With every answer "não": the line "Nenhum sim: o grupo recebe o valor sem divisão entre os ativos."

### Facts beside an asset

One line per asset, muted, cut with an ellipsis and whole in its title when too short:

- A fund with a fund report: "P/VP {n} · distribuído em 12 meses sobre o preço {p} · informe de {mês}" (FR7, FR9 of the fund report), each figure "sem dado" when null.
- A stock with a company report: "ROE {p} · margem {p} · dívida líquida/PL {n} · lucro em {k} de {n} exercícios · 12 meses até {data}" (CR8 to CR10).
- An asset without either: "sem informe nem demonstrações".

The facts are the figures of the existing pure functions; the line computes nothing new and colours nothing.

## Cross-cutting questions

- R1: Does not apply: questions are the investor's text; the facts come from the fund report and company report sources, which own their regional values.
- R2: A region without a report source shows "sem informe nem demonstrações" beside each asset; the questions work the same.
- R3: Does not apply: no value set grows with regions.
- R4: Does not apply: no extension point.
- R5: Keys `contributionPlan.questions.*` with pt-BR and en; the problem texts of `contribution_question_invalid` and `contribution_answers_invalid`.
- R6: The derived ideal through the share format of the plan; the facts through the formats of the fund report and company report.
- C1: No amount is added; ideals are integers of basis points.
- C2: Does not apply: no sum of amounts.
- C3: The facts are shown in their report's currency as ratios; no amount of the book is converted.
- C4: Does not apply: no amount is written by this feature.
- T1: Does not apply: no date is stored; the facts carry their own dates.
- T2: Does not apply.
- B1: Two tables with `books_id`; every query filters by it; a schema test rejects a row without a book, a question of 201 characters, a question at position 10 and an answer whose member position does not exist in the class.
- B2: No new operation; `PUT /contribution-plan` keeps `write`, GET and preview keep `read`; HTTP tests cover a reader that writes (403).
- B3: Does not apply: no setting.
- D1: Both tables are facts of the book in the export; the archive version rises by one and its testdata gains the tables.
- D2: One goose migration for the two tables.
- D3: Does not apply: the plan is replaced whole by each save, as CN1.
- D4: Does not apply: no data from a bank, a file or a model.
- D5: Does not apply.
- S1: No new operation; two new `Problem.code` values, each with an HTTP test.
- S2: Does not apply: the edit mode of the plan is desktop only (ADR 027).
- S3: `internal/assistant/guide/articles/contribution_plan.md` gains the questions, in the commit of the screen.
- S4: The assistant reads and writes questions and answers through `get_portfolio` view `contribution` and `save_contribution_plan` (CQ6).
- X1: S604 a save with questions stores them and returns the derived ideals of CQ7, case 1; S605 the preview of the same draft splits 1,000.00 between the members by those ideals; S606 every answer "não" returns `question_ideals` false and one amount for the group; S607 each invalid case of CQ7 returns its `Problem.code`; S608 a reader's PUT returns 403; S609 `save_contribution_plan` with questions returns the same plan as S604.
- X2: Does not apply: no regional value or currency conversion.

## Approaches

1. A score per asset typed by the investor. Rejected: the owner asked for questions the investor writes, and a typed score is a typed ideal under another name.
2. Weighted questions or answers on a scale. Rejected: not requested; a later delivery can add weights over the same tables.
3. Yes-or-no questions per group, ideals derived by the largest remainder of CN9 and stored as member ideals. Chosen: every rule after CN4 stays unchanged.

## Delivery order

1. Domain rule CQ1 to CQ3 with the cases of CQ7; storage, API, tools (plan 1).
2. The assets panel with questions, answers and facts; the guide article (plan 2).
