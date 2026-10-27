# Assistant phase 4: panel layout and proposals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The panel sits beside the page on a wide screen, answers use the thread's full width with aligned amount columns, proposal cards are compact and reachable, and the welcome screen suggests questions about the current screen.

**Architecture:** The thread (messages, composer, notices) moves into one component rendered in an `AppShellAside` pane from 1200 px and in the existing `Drawer` below it; the turn state stays in the parent so a resize keeps the conversation. Proposal behavior (scroll, expiry, link, batch confirm) lives in the assistant feature. The chat prompt's Format rule gains right-aligned amount columns.

**Tech Stack:** React, TanStack Router and Query, Slotted 0.1.0-beta.16 (`app-shell`, `drawer`, `message`, `markdown`, `description-list`, `card`), Vitest, Playwright (verification only).

**Spec:** `docs/superpowers/specs/2026-10-26-mcp-agent-design.md` (sections 4.5, 4.6, 4.7, 4.10, 4.11). Depends on phases 1 and 2 (`assistant-panel.tsx` as they leave it).

## Global Constraints

- Read `web/CLAUDE.md`, `node_modules/@slotted/react/dist/docs/index.md` and the files of `app-shell`, `drawer`, `message`, `markdown`, `description-list`, `card` before Task 1. Apply the `compose-screen` skill.
- Breakpoints: inline pane from 1200 px; overlay without scrim (`modal={false}`, `scrimFrom={1}`) from 600 to 1199 px; bottom sheet below 600 px (P9).
- An app workaround of a Slotted gap carries `Workaround for Slotted finding "<title>"` and a row in `docs/slotted-findings.md` (web/CLAUDE.md rules 4, 5).
- Task 2 changes the chat system prompt (P11). After the phase, the owner runs the evaluation of ADR 020 C13 and records it under `docs/assistant-eval/`; agents never run it.
- Suggestion texts are catalog entries per language; no regional value (design section 7).
- If `AppShellAside` cannot hold the panel without app CSS targeting parts, that gap is a Slotted finding and Task 1 stops for the owner.

## Review Focus

1. A resize across 1200 px during a running turn: the turn continues, the draft text and the composer's text survive, and focus stays in the thread. Test in Task 1.
2. The inline pane moves no focus on open (drawer.md: "An inline drawer moves no focus when it opens"); P18 still requires the composer focused. Test in Task 1.
3. "Confirmar todas" when the second proposal fails as `stale`: the first stays executed, the second shows its failure, the third stays pending and confirmable. Test in Task 4.
4. A proposal expiring while its confirm request is in flight: the server's answer wins over the client's timer. Test in Task 3.
5. Privacy mode on: copying an answer copies the unmasked Markdown only when privacy is off; with privacy on the copy action copies the masked text. Test in Task 5.

---

### Task 1: The panel beside the page (P9, U8)

**Files:**
- Create: `web/src/features/assistant/assistant-thread.tsx` (`AssistantThread`: header actions, thread, footer; props `turn: AssistantTurn`, `onClose: () => void`, `inline: boolean`)
- Modify: `web/src/features/assistant/assistant-panel.tsx` (holds `useAssistantTurn`; renders `AssistantThread` in `Drawer` below 1200 px)
- Create: `web/src/features/assistant/assistant-aside.tsx` (renders `AssistantThread` inside `AppShellAside` with `AppShellAsideResizer`)
- Modify: `web/src/features/assistant/index.ts`, `web/src/app/shell/app-frame.tsx` (`asideOpen`, `asideMode="inline"` from 1200 px; the `Drawer` path below)
- Modify: `web/src/features/assistant/assistant-panel.module.css`
- Test: `web/src/features/assistant/assistant-panel.test.tsx`, `web/src/app/shell/app-frame.test.tsx`

**Interfaces:**
- Produces: `useAssistantTurn` is called once, in the component that `app-frame.tsx` renders for both placements; `AssistantThread` receives it.

- [ ] **Step 1: Failing tests**

- App frame at `setViewport(1440)`: open the assistant; `document.querySelector('[data-ui="app-shell"] [data-part="aside"]')` contains the composer; no element `[data-ui="drawer"] [data-part="scrim"]` exists; the main region is still in the accessibility tree (not `inert`).
- At `setViewport(1024)`: the drawer renders with no scrim element and without `aria-modal`.
- At `setViewport(390)`: the bottom sheet as today.
- Review Focus 1: at 1440 px with a stream open and `draft` text shown, `setViewport(1024)`; the draft text and the composer's typed text remain; one POST only.
- Review Focus 2: at 1440 px, opening focuses the composer.

- [ ] **Step 2: Run** `pnpm vitest run src/features/assistant src/app/shell` from `web/` — FAIL.

- [ ] **Step 3: Implement**: extract the thread; `AssistantAside` focuses the composer in an effect when it opens (the pane moves no focus itself); the drawer path keeps `initialFocus` and `finalFocus` of phase 1; the `Drawer` gets `modal={false}` and `scrimFrom={1}` from 600 px.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `feat(web): place the assistant beside the page on wide screens`

---

### Task 2: Answers across the thread; amount columns aligned (P10, P11, P12, U9)

**Files:**
- Modify: `web/src/features/assistant/message-item.tsx` (assistant answer without `Bubble`)
- Modify: `web/src/features/assistant/assistant-panel.module.css`
- Modify: `internal/assistant/internal/app/guide.tmpl` (Format section of audience `chat`; `prompt.tmpl` if phase 3 has not run), `internal/assistant/internal/app/testdata/prompt_pt_BR.txt`
- Test: `web/src/features/assistant/assistant-panel.test.tsx`, `internal/assistant/internal/app/prompt_test.go`

- [ ] **Step 1: Failing tests**

- Panel: an assistant answer renders no `[data-ui="bubble"]` ancestor; a user message keeps its bubble.
- Panel: the table of the existing test with `| :--- | ---: | ---: |` renders the October and November cells with the end alignment the Markdown family writes for `---:` (read `markdown.md` for the attribute or style it sets; assert that).
- `TestPromptAlignsAmountColumns`: the chat prompt contains `"Align columns of amounts and counts to the right with ---: in the separator row."`; `TestPrompt`'s golden file is updated to the new text (the spec change P11 is named in the commit body).

- [ ] **Step 2: Run** both — FAIL.

- [ ] **Step 3: Implement**; P12 relies on the Markdown family's own horizontal scroll; at 390 px the verification of Task 6 measures that a three-column table of amounts shows its three headers without scrolling. A family that wraps or clips there is a Slotted finding.

- [ ] **Step 4: Run** `go test ./internal/assistant/internal/app -count=1` and the panel tests — PASS.

- [ ] **Step 5: Commit** `feat(web): show assistant answers across the thread with aligned amounts`

---

### Task 3: Compact, reachable proposal cards (P13, P14, P15, U10, U11)

**Files:**
- Modify: `web/src/features/assistant/proposal-card.tsx`
- Modify: `web/src/features/assistant/assistant-thread.tsx` (scroll on an answer with proposals)
- Create: `web/src/features/assistant/use-expired.ts` (`useExpired(expiresAt: string, active: boolean): boolean`, one timer to the instant)
- Modify: both catalogs (`assistant.proposal.expires`: "Expires at {time}" / "Expira às {time}")
- Test: `web/src/features/assistant/proposal-card.test.tsx`, `web/src/features/assistant/assistant-panel.test.tsx`

- [ ] **Step 1: Failing tests**

- `it("scrolls the actions of the last card into view (U10)")`: an `answer` with two proposals; `Element.prototype.scrollIntoView` (stubbed) was called on the footer of the last card, or the family's scroll-to-item API was called with the answer's message ID (read `message-scroller.md` and assert the call the family exposes).
- `it("shows the expiry and turns expired without a click (P15)")`: fake timers at `10:00:00`, `expires_at` `10:05:00`; text `Expires at 10:05`; advance 5 minutes; the badge reads `Expired` and no `Confirm` button remains.
- Review Focus 4: confirm clicked at `10:04:59` with the route resolving after the timer passes and answering `executed` → the card shows `Executed`.
- `it("lays the fields in two columns from 400 px of card width (P14)")`: assert the attribute `DescriptionList` writes for its column count, per `description-list.md`; when the family has no container-width rule, record a Slotted finding and assert the fallback the task chooses.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `feat(web): keep assistant proposals compact and in view`

---

### Task 4: Open the result; confirm all (P16, P17)

**Files:**
- Create: `web/src/features/assistant/proposal-screen.ts` (`proposalScreen(tool: string, result: unknown): string | undefined`)
- Modify: `web/src/features/assistant/proposal-card.tsx` ("Abrir" link through `useAppLink`)
- Create: `web/src/features/assistant/confirm-all.tsx` (`ConfirmAll({ proposals }: { proposals: AssistantProposal[] })`)
- Modify: `web/src/features/assistant/message-item.tsx`, both catalogs (`assistant.proposal.open`: "Open" / "Abrir"; `assistant.proposal.confirm_all`: "Confirm all" / "Confirmar todas")
- Test: `web/src/features/assistant/proposal-screen.test.ts`, `web/src/features/assistant/proposal-card.test.tsx`

**Interfaces:**
- `proposalScreen` holds a table keyed by tool name: the result field holding the entity ID and the navigation-map path pattern; it returns the path only when `matchScreen(path)` finds a screen. The rows come from the output schemas of the write tools whose output names a created or changed entity with a record screen; read the schemas from `GET /api/v1/...` tests or `internal/server/tool_output_test.go`.

- [ ] **Step 1: Failing tests**

- `proposalScreen("record_transaction", { transaction_id: "t1" })` (use the field name the tool's output schema declares) → the transaction record path of the navigation map with `t1`; an unknown tool → `undefined`; a result without the field → `undefined`.
- Card: an `executed` proposal of `record_transaction` shows a link `Open` to that path.
- `ConfirmAll`: three pending proposals; one click confirms them in order (captured POST order); Review Focus 3: the second answers 409 `proposal_stale` → the first shows `Executed`, the second its failure, the third stays `Pending` with its own `Confirm` enabled, and `Confirm all` is gone.
- One pending proposal → no `Confirm all`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**; confirmations reuse `confirmProposal` and update each card's cache entry as the single confirm does.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `feat(web): open the result of a proposal and confirm several at once`

---

### Task 5: Suggestions by screen; copy an answer (P20, P21)

**Files:**
- Create: `web/src/features/assistant/route-suggestions.ts` (`routeSuggestions(pathname: string): readonly MessageKey[]`, three keys per group `overview`, `transactions`, `cards`, `planning`, `reports`, `other`)
- Modify: `web/src/features/assistant/chat-welcome.tsx` (prop `suggestions`)
- Modify: `web/src/features/assistant/message-item.tsx` (copy action)
- Modify: both catalogs (18 suggestion keys `assistant.suggestion.<group>.<n>`; `assistant.copy`: "Copy" / "Copiar"; `assistant.copied`: "Copied" / "Copiado")
- Test: `web/src/features/assistant/route-suggestions.test.ts`, `web/src/features/assistant/assistant-panel.test.tsx`

- [ ] **Step 1: Failing tests**

- `routeSuggestions("/transactions/abc")` → the three `transactions` keys; `/cards` → `cards`; `/planning/schedules` → `planning`; `/reports/x` → `reports`; `/overview` and `/` → `overview`; `/settings` → `other`. Each returned key exists in both catalogs.
- Panel at `/transactions`: the three transaction suggestions show.
- Copy: `navigator.clipboard.writeText` (stubbed) receives the answer's Markdown; Review Focus 5: with `hideAmounts()`, it receives the masked text (`maskAmountText` of the Markdown).

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**; the copy control uses the message family's action slot when it has one (`message.md`), else an `IconButton` in the message footer.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `feat(web): suggest questions for the current screen and copy answers`

---

### Task 6: Phase verification

- [ ] **Step 1:** `make check` — PASS.
- [ ] **Step 2:** `make run-prod` with the study's scripted stub (never a real key), Playwright `launch()` closed in `finally`, at most four screenshots per width:
  - 1440 px: the page's main region narrows when the panel opens (record its width before and after); no scrim pixel over the page (U8).
  - 390 px: a three-column table of amounts shows its three headers without horizontal scroll; the answer's text column is at least 340 px wide (U9).
  - 390 px: after a proposal answer, the last card's Confirm button is inside the viewport (U10).
- [ ] **Step 3:** Hand off to the owner: run the evaluation of ADR 020 C13 for the P11 prompt change and record it under `docs/assistant-eval/`. Report with a "Slotted findings" section.
