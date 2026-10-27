# Assistant phase 5: assistant settings onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user without a provider sees three plain choices in the Assistente section; features, chains, usage and limits sit under "Avançado"; every badge carries a one-sentence explanation.

**Architecture:** The Assistente section of `/settings` branches on the providers list: no provider shows a choice of three paths that open the existing provider dialog with a preset, or the external access section of phase 3. The rest of the section moves into a collapsed region while the configuration is the default one.

**Tech Stack:** React, TanStack Query, Slotted 0.1.0-beta.16, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-mcp-agent-design.md` (section 5). Depends on phase 3 (topic `external_access`) and on the settings rework of another session being committed.

## Global Constraints

- `web/src/features/setup/settings-assistant.tsx`, `settings-row.tsx`, `settings-group.tsx` and both catalogs carry uncommitted work of another session; this phase starts only after that work is committed, and reads those files as they are then. If the hint pattern named in S3 does not exist then, `SettingsRow`'s `description` is the pattern.
- No backend change.
- Preset IDs come from `GET /assistant/presets` (`gemini`, `ollama`, `lmstudio`); no preset ID is a literal except in the choice list of Task 1, which names `gemini`, `ollama` and `lmstudio` as `domain.Presets()` declares them.
- The Gemini choice states that free-tier content trains Google's models and links the key page; the URL comes from a catalog entry beside the existing `assistant.notice.trains.detail`.

## Review Focus

1. An instance provider configured by the server (`EQUORI_GEMINI_API_KEY`), with no provider of the user's own: the chat works, so the three choices do not show; the section shows the instance provider as today. Test in Task 1.
2. A user who deletes their last provider: the section returns to the three choices without a reload. Test in Task 1.
3. A user with one provider and one use on a custom chain: "Avançado" opens expanded, because the custom chain is state the user set. Test in Task 2.
4. The provider dialog opened from a choice and cancelled: the choices stay, nothing is created. Test in Task 1.
5. Keyboard: the three choices are reachable by Tab and activate with Enter and Space. Test in Task 1.

---

### Task 1: Three choices without a provider (S1)

**Files:**
- Create: `web/src/features/setup/assistant-start.tsx` (`AssistantStart({ onPreset, onExternal }: { onPreset: (preset: "gemini" | "ollama" | "lmstudio") => void; onExternal: () => void })`)
- Modify: `web/src/features/setup/settings-assistant.tsx` (renders `AssistantStart` when `providers.data.items` holds no provider and `GET /assistant/chat` is not `available`)
- Modify: `web/src/features/setup/provider-dialog.tsx` (prop `initialPreset?: string`)
- Modify: both catalogs (`assistant.start.title`, `assistant.start.gemini`, `assistant.start.gemini.detail`, `assistant.start.local`, `assistant.start.local.detail`, `assistant.start.external`, `assistant.start.external.detail`, `assistant.start.gemini.key_url`)
- Test: `web/src/features/setup/settings-assistant.test.tsx`

- [ ] **Step 1: Failing tests**

- No provider, chat unavailable: three choices named by `assistant.start.gemini`, `assistant.start.local`, `assistant.start.external`; the Gemini choice's text contains `assistant.notice.trains.detail`'s sentence and a link to the key URL.
- Choosing Gemini opens the provider dialog with the service field set to `Google Gemini`; choosing local opens it with `Ollama (local)`.
- Choosing external navigates to `{ to: "/settings", search: { section: "external_access" } }`.
- Review Focus 1: no own provider, chat `available: true` with an instance provider → no choices.
- Review Focus 2: one provider; delete it; the choices show.
- Review Focus 4: open the dialog from a choice and cancel → no POST, choices visible.
- Review Focus 5: `userEvent.tab()` reaches each choice; Enter on the local choice opens the dialog.

- [ ] **Step 2: Run** `pnpm vitest run src/features/setup/settings-assistant.test.tsx` from `web/` — FAIL.

- [ ] **Step 3: Implement** with the family that the settings page uses for picture or card choices (read `compose-screen` and the family file before choosing).

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `feat(web): offer three ways to start the assistant`

---

### Task 2: "Avançado" and explained badges (S2, S3, U15)

**Files:**
- Modify: `web/src/features/setup/settings-assistant.tsx`
- Modify: `web/src/features/setup/chain-dialog.tsx` (capability badges)
- Modify: both catalogs (`assistant.advanced`: "Advanced" / "Avançado"; one `.hint` key per capability, per `assistant.use.default` and per `assistant.use.custom`)
- Test: `web/src/features/setup/settings-assistant.test.tsx`

- [ ] **Step 1: Failing tests**

- One provider, every use `default: true`: a collapsed control named `Advanced` (`aria-expanded="false"`); the uses list, usage and limits are not in the accessibility tree until it expands.
- Review Focus 3: one use with `default: false` → `Advanced` renders expanded.
- Two providers → expanded.
- Each capability badge and each `Default`/`Custom` badge has an accessible description equal to its `.hint` text (`toHaveAccessibleDescription`).

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** with the disclosure family the settings page uses elsewhere (`accordion` or the family named in `index.md` for a collapsible region).

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `feat(web): move advanced assistant settings under one disclosure`

---

### Task 3: Phase verification

- [ ] **Step 1:** `make check` — PASS.
- [ ] **Step 2:** `make run-prod` with a fresh user without providers; Playwright `launch()` closed in `finally`, at 1440 and 390 px: the three choices show; choosing local opens the dialog with Ollama. At most four screenshots.
- [ ] **Step 3:** Report with a "Slotted findings" section.
