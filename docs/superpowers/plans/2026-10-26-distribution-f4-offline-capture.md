# Distribution F4: Offline Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The installed application opens without the server, queues texts typed on the phone, and turns each queued text into transactions dated from the day it was written once the server answers.

**Architecture:** `previewCapture` accepts `reference_date`, against which every date phrase resolves. The web application remembers the device's last user, redirects to `/offline` when the profile request gets no HTTP response, keeps a per-user queue in `localStorage`, lists it at `/transactions/queue`, and opens each entry in the existing capture screen with its reference date. A static service worker keeps the shell and its files for a start without the server.

**Tech Stack:** Go (capture module, oapi-codegen strict server), React 19, TanStack Router and Query, Slotted (`@slotted/react`), Vitest with jsdom, a classic-script service worker.

**Spec:** `docs/superpowers/specs/2026-10-26-distribution-design.md` (phase F4: D7, P1 to P9, P4a).

**Requires:** F1 only for its release. Independent of F2 and F3.

## Global Constraints

- Read `web/CLAUDE.md` before any change under `web/`. Rules O1 to O14 apply: one component per file in kebab-case, a feature imports another only through its `index.ts`, no literal text in JSX (every string through `useT()`), text through Slotted families.
- Every new string exists in `web/src/i18n/catalog.en.ts` and `web/src/i18n/catalog.pt-BR.ts`, with the exact values of the tables in Tasks 4 and 5.
- Storage keys: `equori.device.user` (last user), `equori.capture.queue` (queue). Every access is wrapped in `try`/`catch`, as `web/src/features/transactions/capture-store.ts` does, except the queue write, which throws (P7).
- No `/api/` response is ever stored by the service worker or the queue.
- `reference_date` accepts at most the instance's today plus one day; a later date is 422 `validation_failed` with a field error on `reference_date`.
- No new web or Go dependency.
- New amendment and scenario numbers: amendment A128; scenarios S151, S152, S153.
- Web tests clear `localStorage` in `beforeEach`.

## Review Focus

1. A queued text whose processing fails (server error on record): the entry must stay in the queue. Test in Task 5 (`keeps the entry when recording fails`).
2. The device storage refuses the write (full or private mode): the text must stay in the field with an error. Test in Task 4.
3. Two people use the same phone: the queue of one is never listed for the other. Test in Task 3 (`readQueue` per user) and Task 5 (queue page lists only the signed-in user's entries).
4. A server upgrade while the phone holds an old shell: the next online navigation must replace the shell and drop the old files. Test in Task 6 (`replaces the shell and clears assets when index.html changes`).
5. "ontem" typed on Monday and processed on Wednesday: the transaction is dated Sunday. Scenario S151 (Task 1) and the queued-mode request test (Task 5).

---

### Task 1: `reference_date` in `previewCapture` (A128, S151 to S153)

**Files:**
- Modify: `api/openapi.yaml` (`components.schemas.CapturePreviewInput`)
- Regenerate: `make gen` (writes `internal/capture/internal/adapter/httpapi/api.gen.go`, `web/src/api/schema.gen.ts`)
- Modify: `internal/capture/internal/app/service.go` (`Preview`, new `ErrReferenceDate`)
- Modify: `internal/capture/internal/adapter/httpapi/server.go` (`PreviewCapture`, error mapping)
- Test: `internal/capture/preview_test.go`

**Interfaces:**
- Produces:
  - JSON property `reference_date` (`string`, `format: date`, optional) on `CapturePreviewInput`; web type `components["schemas"]["CapturePreviewInput"]["reference_date"]`.
  - `func (s *Service) Preview(ctx context.Context, userID int64, text string, defaultAccount uuid.UUID, reference time.Time) ([]Line, error)`: a zero `reference` means today.
  - `var ErrReferenceDate = errors.New("the reference date is more than one day after today")`.

- [ ] **Step 1: Write the failing test** at the end of `internal/capture/preview_test.go`:

```go
// A128: the dates of a text written offline resolve against the day it was written.
func TestPreviewReferenceDate(t *testing.T) {
	t.Parallel()
	b := newBooks(t)
	at := func(t *testing.T, text, reference string) lineView {
		t.Helper()
		var out struct {
			Lines []lineView `json:"lines"`
		}
		b.h.MustDo(http.MethodPost, "/api/v1/capture/preview",
			map[string]any{"text": text, "default_account_id": b.wallet, "reference_date": reference}, http.StatusOK, &out)
		if len(out.Lines) != 1 {
			t.Fatalf("lines = %d, want 1", len(out.Lines))
		}
		return out.Lines[0]
	}
	t.Run("S151", func(t *testing.T) {
		if l := at(t, "mercado 30 ontem", "2026-10-18"); l.Date != "2026-10-17" {
			t.Fatalf("date = %s, want 2026-10-17", l.Date)
		}
	})
	t.Run("S152", func(t *testing.T) {
		if l := at(t, "mercado 30", "2026-10-18"); l.Date != "2026-10-18" {
			t.Fatalf("date = %s, want 2026-10-18", l.Date)
		}
	})
	t.Run("S153", func(t *testing.T) {
		if l := at(t, "mercado 30", "2026-10-22"); l.Date != "2026-10-22" {
			t.Fatalf("date = %s, want 2026-10-22 (today plus one day)", l.Date)
		}
		b.h.ExpectProblem(b.h.Do(http.MethodPost, "/api/v1/capture/preview",
			map[string]any{"text": "mercado 30", "reference_date": "2026-10-23"}),
			http.StatusUnprocessableEntity, "validation_failed", "reference_date")
	})
}
```

`newBooks` fixes today at 2026-10-21.

- [ ] **Step 2: Run** `make db-test-up && go test -run TestPreviewReferenceDate ./internal/capture/`
Expected: FAIL: S151 date `2026-10-20`, S152 `2026-10-21`; S153 gets 200 where 422 is expected, or 400 `invalid_request` because the contract rejects the unknown property (`additionalProperties: false`).

- [ ] **Step 3: Contract.** Add to `CapturePreviewInput.properties`:

```yaml
        reference_date:
          type: string
          format: date
          description: The day the text was written; date phrases resolve against it (A128). Today when absent; at most today plus one day.
```

Run `make gen`. Expected: `api.gen.go` gains `ReferenceDate *openapi_types.Date`; `schema.gen.ts` gains `reference_date?: string`.

- [ ] **Step 4: Service.** In `Preview`, replace

```go
	y, m, d := s.ledger.Today().Date()
	read := domain.Read(text, v, time.Date(y, m, d, 0, 0, 0, 0, time.UTC), defaultAccount)
```

with

```go
	y, m, d := s.ledger.Today().Date()
	day := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	if !reference.IsZero() {
		// A day ahead is accepted: the device that wrote the text may sit east of the instance's zone.
		if reference.After(day.AddDate(0, 0, 1)) {
			return nil, ErrReferenceDate
		}
		day = reference
	}
	read := domain.Read(text, v, day, defaultAccount)
```

Declare `ErrReferenceDate` beside `ErrDefaultAccount` with the comment `// ErrReferenceDate: reference_date lies more than one day after the instance's today (A128).`

- [ ] **Step 5: Handler.** In `PreviewCapture`:

```go
	var reference time.Time
	if req.Body.ReferenceDate != nil {
		y, m, d := req.Body.ReferenceDate.Date()
		reference = time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	}
	lines, err := s.svc.Preview(ctx, auth.MustUserID(ctx), req.Body.Text, def, reference)
```

In the error mapping, after the `ErrDefaultAccount` case:

```go
	case errors.Is(err, app.ErrReferenceDate):
		d := problem.New(http.StatusUnprocessableEntity, "validation_failed", err.Error())
		d.Errors = []problem.FieldError{{Field: "reference_date", Message: err.Error()}}
		return d, true
```

Run `grep -rn "svc.Preview(\|\.Preview(ctx, " internal/capture` and update every other caller of the service's `Preview` with `time.Time{}`.

- [ ] **Step 6: Run** `go test ./internal/capture/... ./internal/server/...`
Expected: PASS (the server package holds `tool_exposure_test.go`; no operation was added).

- [ ] **Step 7: Specs.**
  - `docs/superpowers/specs/2026-10-21-text-capture-design.md`: line 3 becomes `Amendments A106–A118 and A128, and scenarios S99–S113 and S151–S153 of \`docs/domain/06-scenarios.md\`.`; after section `## A118`, add `## A128 Reference date` with the rule of Step 4 in two sentences and a table of S151 to S153 (text, reference date, result) using the values of Step 1.
  - `docs/domain/06-scenarios.md`, section 6.18: append `S151–S153 read text against a reference date (amendment A128, \`TestPreviewReferenceDate\`).` and in the summary paragraph near line 443 change `text capture and the transaction batch by S99–S112` to `text capture and the transaction batch by S99–S112 and S151–S153`.

- [ ] **Step 8: Commit**

```bash
git add api/openapi.yaml internal/capture web/src/api/schema.gen.ts docs/superpowers/specs/2026-10-21-text-capture-design.md docs/domain/06-scenarios.md
git commit -m "feat(capture): resolve dates against the day a text was written" -m "A text written offline is read days later; without a reference its
'ontem' and its undated lines took the day of reading. reference_date
replaces today for the reading and accepts at most today plus one day
(amendment A128, scenarios S151 to S153)."
```

---

### Task 2: The device's last user (P4a)

**Files:**
- Create: `web/src/features/session/device-user.ts`
- Test: `web/src/features/session/device-user.test.ts`
- Modify: `web/src/features/session/index.ts` (exports)
- Modify: `web/src/features/session/use-logout.ts` (`onSuccess` forgets the user)
- Test: `web/src/features/session/use-logout.test.tsx` (new)
- Modify: `web/src/app/router.tsx` (`authedRoute.beforeLoad` stores the user)
- Test: `web/src/app/router-offline.test.tsx` (new; Task 4 adds the redirect test to it)

**Interfaces:**
- Produces (exported from `@/features/session`):

```ts
export interface DeviceUser { id: number; email: string }
export function rememberDeviceUser(user: DeviceUser): void
export function readDeviceUser(): DeviceUser | null
export function forgetDeviceUser(): void
```


- [ ] **Step 1: Write the failing store test** `device-user.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import {
  forgetDeviceUser,
  readDeviceUser,
  rememberDeviceUser,
} from "@/features/session/device-user";

describe("device user", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null before any sign-in", () => {
    expect(readDeviceUser()).toBeNull();
  });

  it("keeps id and email until forgotten", () => {
    rememberDeviceUser({ id: 7, email: "owner@equori.test" });
    expect(readDeviceUser()).toEqual({ id: 7, email: "owner@equori.test" });
    forgetDeviceUser();
    expect(readDeviceUser()).toBeNull();
  });

  it("ignores a stored value of another shape", () => {
    localStorage.setItem("equori.device.user", '{"id":"7"}');
    expect(readDeviceUser()).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `cd web && pnpm exec vitest run src/features/session/device-user.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `device-user.ts`** following `capture-store.ts`: key `equori.device.user`, JSON `{ id, email }`, a type guard (`typeof id === "number"` and `typeof email === "string"`), every storage call inside `try`/`catch` returning `null` or doing nothing. File comment: `// P4a of ADR 021: the session cookie is HttpOnly and no API answer is stored, so the device keeps its own record of who queues offline.` Export the three functions and the type from `features/session/index.ts`.

- [ ] **Step 4: Run** the store test. Expected: PASS.

- [ ] **Step 5: Write the failing router and logout tests**

`web/src/app/router-offline.test.tsx`:

```tsx
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { readDeviceUser } from "@/features/session";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

describe("offline redirect", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores the last user of the device on an authenticated load", async () => {
    await renderApp("/transactions/capture", {
      fetch: fakeApi({
        ...sharedRoutes,
        "GET /api/v1/me": () =>
          json(200, { id: 7, email: "owner@equori.test", role: "admin", language: "en", region: "US" }),
      }),
    });
    await waitFor(() => {
      expect(readDeviceUser()).toEqual({ id: 7, email: "owner@equori.test" });
    });
  });

  it("keeps sending a signed-out visitor to the login page", async () => {
    const { router } = await renderApp("/transactions", {
      fetch: fakeApi({}),
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
  });
});
```

The third test relies on `fakeApi` answering an unknown route with 404; if `GET /api/v1/me` must answer 401 for the login redirect, add `"GET /api/v1/me": () => problem(401, "unauthorized")` (import `problem`).

`web/src/features/session/use-logout.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";

import { readDeviceUser, rememberDeviceUser } from "@/features/session/device-user";
import { useLogout } from "@/features/session/use-logout";
import { fakeApi } from "@/testing/fake-api";
import { renderWithRouter } from "@/testing/render-app";

function LogoutProbe() {
  const { logout } = useLogout();
  return (
    <button type="button" onClick={logout}>
      {"logout"}
    </button>
  );
}

beforeEach(() => {
  localStorage.clear();
});

it("forgets the device user on logout", async () => {
  rememberDeviceUser({ id: 7, email: "owner@equori.test" });
  renderWithRouter(<LogoutProbe />, {
    path: "/",
    fetch: fakeApi({ "DELETE /api/v1/session": () => new Response(null, { status: 204 }) }),
  });
  await userEvent.click(screen.getByRole("button", { name: "logout" }));
  await waitFor(() => {
    expect(readDeviceUser()).toBeNull();
  });
});
```

- [ ] **Step 6: Run** `cd web && pnpm exec vitest run src/app/router-offline.test.tsx src/features/session/use-logout.test.tsx`
Expected: the first router test and the logout test FAIL; the login test passes.

- [ ] **Step 7: Implement.**
  - `router.tsx`, `authedRoute.beforeLoad`:

```ts
    try {
      const me = await context.queryClient.query({
        ...meQuery(context.api),
        staleTime: "static",
        // One retry: a start without the server should reach /offline in seconds.
        retry: 1,
      });
      rememberDeviceUser({ id: me.id, email: me.email });
    } catch (error) {
```

  The `catch` block stays as it is in this task; Task 4 adds the offline branch.
  - `use-logout.ts`: in `onSuccess`, call `forgetDeviceUser()` before `navigate`.

- [ ] **Step 8: Run** the two test files again. Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/src/features/session web/src/app/router.tsx web/src/app/router-offline.test.tsx
git commit -m "feat(web): remember the last user of the device" -m "Each authenticated load stores the profile's id and email and logout
forgets them, so a capture written offline belongs to a known user
(ADR 021, P4a)."
```

---

### Task 3: The capture queue store (P4, P7, P8)

**Files:**
- Create: `web/src/features/transactions/capture-queue.ts`
- Test: `web/src/features/transactions/capture-queue.test.ts`
- Modify: `web/src/features/transactions/index.ts` (exports)

**Interfaces:**
- Produces (exported from `@/features/transactions`):

```ts
export interface QueuedCapture {
  id: string;            // crypto.randomUUID()
  userId: number;
  text: string;
  defaultAccountId: string | null;
  capturedOn: string;    // YYYY-MM-DD, the device's local date
  createdAt: string;     // ISO 8601 instant
}
export function readQueue(userId: number): QueuedCapture[]           // oldest createdAt first
export function findQueued(id: string): QueuedCapture | undefined
export function enqueueCapture(entry: Omit<QueuedCapture, "id" | "createdAt">, now?: Date): QueuedCapture // throws QueueWriteError
export function removeQueued(id: string): void
export class QueueWriteError extends Error {}
```

- [ ] **Step 1: Write the failing tests**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  QueueWriteError,
  enqueueCapture,
  findQueued,
  readQueue,
  removeQueued,
} from "@/features/transactions/capture-queue";

const entry = (userId: number, text: string) => ({
  userId,
  text,
  defaultAccountId: null,
  capturedOn: "2026-10-18",
});

describe("capture queue", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists the entries of one user, oldest first", () => {
    const first = enqueueCapture(entry(7, "mercado 30 ontem"), new Date("2026-10-18T10:00:00Z"));
    enqueueCapture(entry(8, "other user's text"), new Date("2026-10-18T10:01:00Z"));
    const second = enqueueCapture(entry(7, "uber 12"), new Date("2026-10-18T10:02:00Z"));
    expect(readQueue(7).map((e) => e.id)).toEqual([first.id, second.id]);
    expect(readQueue(8)).toHaveLength(1);
    expect(first.createdAt).toBe("2026-10-18T10:00:00.000Z");
  });

  it("finds and removes one entry", () => {
    const queued = enqueueCapture(entry(7, "uber 12"));
    expect(findQueued(queued.id)?.text).toBe("uber 12");
    removeQueued(queued.id);
    expect(findQueued(queued.id)).toBeUndefined();
    expect(readQueue(7)).toEqual([]);
  });

  it("throws when the device refuses the write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => enqueueCapture(entry(7, "uber 12"))).toThrow(QueueWriteError);
  });

  it("skips stored entries of another shape", () => {
    localStorage.setItem(
      "equori.capture.queue",
      JSON.stringify([{ id: "x" }, { id: "y", userId: 7, text: "ok", defaultAccountId: null, capturedOn: "2026-10-18", createdAt: "2026-10-18T10:00:00.000Z" }]),
    );
    expect(readQueue(7).map((e) => e.id)).toEqual(["y"]);
  });

  it("asks the browser to keep its storage on the first entry", () => {
    const persist = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal("navigator", { ...navigator, storage: { persist } });
    enqueueCapture(entry(7, "uber 12"));
    expect(persist).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run** `cd web && pnpm exec vitest run src/features/transactions/capture-queue.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement.** Key `equori.capture.queue`; the stored value is a JSON array of `QueuedCapture`. `readAll()` parses with a type guard per entry and returns `[]` on any read error. `enqueueCapture` builds `{ ...entry, id: crypto.randomUUID(), createdAt: (now ?? new Date()).toISOString() }`, writes `[...readAll(), queued]` with `localStorage.setItem` inside `try`, and on failure throws `new QueueWriteError("the device refused to store the capture")`. When the array was empty before the write, it calls `void navigator.storage?.persist?.()` (P8). `removeQueued` writes the array without the id inside `try`/`catch` (a failed removal leaves the entry, never loses one). `readQueue` filters by `userId` and sorts by `createdAt`. File comment: `// P4 of ADR 021: texts written without the server, kept until recorded or discarded.`

- [ ] **Step 4: Run** the test. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/transactions/capture-queue.ts web/src/features/transactions/capture-queue.test.ts web/src/features/transactions/index.ts
git commit -m "feat(web): keep a per-user queue of captures written offline" -m "Entries live in localStorage, are listed per user, and a refused write
throws so the screen keeps the text (ADR 021, P4, P7 and P8)."
```

---

### Task 4: The offline screen and the redirect to it (P3)

**Files:**
- Modify: `web/src/app/router.tsx` (offline branch of `authedRoute.beforeLoad`; new `offlineRoute`)
- Modify: `web/src/app/router-offline.test.tsx` (redirect test)
- Create: `web/src/features/transactions/offline-page.tsx`
- Test: `web/src/features/transactions/offline-page.test.tsx`
- Modify: `web/src/features/transactions/index.ts` (export `OfflinePage`)
- Modify: `web/src/i18n/catalog.en.ts`, `web/src/i18n/catalog.pt-BR.ts`

**Interfaces:**
- Consumes: `readDeviceUser` (Task 2, from `@/features/session`), `enqueueCapture`, `readQueue`, `removeQueued`, `QueueWriteError` (Task 3), `CaptureComposer` (`@/features/transactions/capture-composer`, props `value`, `onChange`, `onRecord`, `busy`, `autoFocus`), `readDefaultAccount` (`capture-store.ts`), `useToday` (`@/i18n/today`), `formatDate` (`@/i18n/format`), `useAppLocale` (`@/i18n/i18n-provider`).
- Produces: `export function OfflinePage()`; route `/offline` under the root route, outside authentication.

Strings (key, English, Portuguese):

| Key | en | pt-BR |
|---|---|---|
| `offline.title` | No connection to the server | Sem conexão com o servidor |
| `offline.subheading` | Write what you spent; equori reads it when the server answers again. | Escreva o que gastou; o equori lê quando o servidor responder de novo. |
| `offline.user` | Queued for {email} | Na fila de {email} |
| `offline.noUser` | Sign in once with the server reachable to write captures on this device without it. | Entre uma vez com o servidor acessível para lançar neste aparelho sem ele. |
| `offline.queue` | Queue | Guardar na fila |
| `offline.retry` | Try again | Tentar de novo |
| `offline.queued` | Waiting | Na fila |
| `offline.empty` | Nothing waiting. | Nada na fila. |
| `offline.writeFailed` | The device refused to store the text; it stays in the field. | O aparelho recusou guardar o texto; ele continua no campo. |
| `queue.discard` | Discard | Descartar |
| `queue.writtenOn` | Written on {date} | Escrito em {date} |

Layout, top to bottom, inside `Page width="wide"`: `PageHeader size="lg"` with `PageHeaderTitle`/`PageHeaderHeading` = `offline.title`, `PageHeaderDescription` = `offline.subheading`, and `PageHeaderActions` holding `Button variant="outline" tone="secondary"` = `offline.retry`, which calls `navigate({ to: "/" })`. Then `PageBody`:
  - Without a device user: one `InlineMessage tone="info" size="md"` = `offline.noUser`. Nothing else.
  - With a device user: `Stack gap={4}` holding `Text size="sm" tone="muted"` = `offline.user`; `CaptureComposer` (`busy={false}`, `autoFocus={false}`, `onRecord` = queue); an `InlineMessage tone="danger" size="md" live="polite"` = `offline.writeFailed` after a `QueueWriteError`; `Button` = `offline.queue`, disabled while the trimmed text is empty; then `List variant="separated"` with `ListSection label={t("offline.queued")}`, `ListEmpty` = `offline.empty` when empty, otherwise one `ListItem` per entry: `ListItemContent` > `ListItemBody` > `ListItemLabel` (the text) and `ListItemDescription` (`queue.writtenOn` with `formatDate(capturedOn, locale)`), and `ListItemActions` with `Button size="sm" variant="ghost" tone="secondary"` = `queue.discard`.
  - Queue action: `enqueueCapture({ userId: user.id, text, defaultAccountId: readDefaultAccount(), capturedOn: today })`; on success clear the text and re-read the list; on `QueueWriteError` keep the text and show the message.
  - Imports of Slotted parts come from `@slotted/react/page`, `@slotted/react/page-header`, `@slotted/react/button`, `@slotted/react/inline-message`, `@slotted/react/list`, `@slotted/react/list-item`, `@slotted/react/stack`, `@slotted/react/typography`, as in `capture-page.tsx` and `features/setup/usage-list.tsx`.

- [ ] **Step 1: Add the strings** of the table to both catalogs (alphabetical position is not required; place them after the `capture.*` block).

- [ ] **Step 2: Write the failing tests.** Add to `web/src/app/router-offline.test.tsx` the imports `screen` (from `@testing-library/react`), `rememberDeviceUser` (from `@/features/session`) and `catalogEn` (from `@/i18n/catalog.en`), and inside its `describe`:

```tsx
  it("opens /offline when the profile request gets no answer", async () => {
    rememberDeviceUser({ id: 7, email: "owner@equori.test" });
    const { router } = await renderApp("/transactions", {
      fetch: fakeApi({
        "GET /api/v1/me": () => Promise.reject(new TypeError("Failed to fetch")),
      }),
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/offline");
    });
    expect(
      await screen.findByRole("heading", { name: catalogEn["offline.title"] }),
    ).toBeInTheDocument();
  });

```

Then `offline-page.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rememberDeviceUser } from "@/features/session";
import { readQueue } from "@/features/transactions/capture-queue";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const offline = () =>
  fakeApi({ "GET /api/v1/me": () => Promise.reject(new TypeError("Failed to fetch")) });

describe("OfflinePage", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("queues a text for the device's last user with the day it was written", async () => {
    rememberDeviceUser({ id: 7, email: "owner@equori.test" });
    await renderApp("/offline", { fetch: offline(), today: "2026-10-18" });
    expect(screen.getByText("Queued for owner@equori.test")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "mercado 30 ontem");
    await userEvent.click(screen.getByRole("button", { name: catalogEn["offline.queue"] }));
    expect(readQueue(7)).toMatchObject([{ text: "mercado 30 ontem", capturedOn: "2026-10-18" }]);
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByText("mercado 30 ontem")).toBeInTheDocument();
  });

  it("discards an entry on request", async () => {
    rememberDeviceUser({ id: 7, email: "owner@equori.test" });
    await renderApp("/offline", { fetch: offline() });
    await userEvent.type(screen.getByRole("textbox"), "uber 12");
    await userEvent.click(screen.getByRole("button", { name: catalogEn["offline.queue"] }));
    await userEvent.click(screen.getByRole("button", { name: catalogEn["queue.discard"] }));
    expect(readQueue(7)).toEqual([]);
    expect(screen.getByText(catalogEn["offline.empty"])).toBeInTheDocument();
  });

  it("keeps the text when the device refuses the write", async () => {
    rememberDeviceUser({ id: 7, email: "owner@equori.test" });
    await renderApp("/offline", { fetch: offline() });
    await userEvent.type(screen.getByRole("textbox"), "uber 12");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    await userEvent.click(screen.getByRole("button", { name: catalogEn["offline.queue"] }));
    expect(screen.getByText(catalogEn["offline.writeFailed"])).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("uber 12");
  });

  it("offers no queue on a device nobody signed in on", async () => {
    await renderApp("/offline", { fetch: offline() });
    expect(screen.getByText(catalogEn["offline.noUser"])).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("tries the server again", async () => {
    rememberDeviceUser({ id: 7, email: "owner@equori.test" });
    const { router } = await renderApp("/offline", { fetch: offline() });
    await userEvent.click(screen.getByRole("button", { name: catalogEn["offline.retry"] }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/offline");
    });
  });
});
```

If `CaptureComposer` renders more than one textbox, select by its accessible name instead (read `capture-composer.tsx` for the label it sets).

- [ ] **Step 3: Run** `cd web && pnpm exec vitest run src/features/transactions/offline-page.test.tsx`
Expected: FAIL (no `/offline` route or no `OfflinePage`).

- [ ] **Step 4: Implement `offline-page.tsx`** per the layout above. Keep the list in component state initialised from `readQueue(user.id)` and refreshed after each queue or discard. Export it from `features/transactions/index.ts`. In `router.tsx`, add to the `catch` of `authedRoute.beforeLoad`, after the 401 branch:

```ts
      // fetch rejects with a TypeError when no HTTP answer arrives (P3 of ADR 021).
      if (error instanceof TypeError) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirects are thrown objects.
        throw redirect({ to: "/offline" });
      }
```

and add `const offlineRoute = createRoute({ getParentRoute: () => rootRoute, path: "/offline", component: OfflinePage });` to `rootRoute.addChildren([...])` beside `loginRoute`.

- [ ] **Step 5: Run** the offline page test and `src/app/router-offline.test.tsx`. Expected: PASS.

- [ ] **Step 6: Run** `cd web && pnpm typecheck && pnpm lint && pnpm format:check`. Expected: no error.

```bash
git add web/src/app/router.tsx web/src/app/router-offline.test.tsx web/src/features/transactions/offline-page.tsx web/src/features/transactions/offline-page.test.tsx web/src/features/transactions/index.ts web/src/i18n/catalog.en.ts web/src/i18n/catalog.pt-BR.ts
git commit -m "feat(web): write captures without the server" -m "A profile request without an HTTP answer redirects to /offline, which holds a text field that queues the text for the device's last
user with the day it was written, the list of waiting texts with a
discard action, and a retry. A refused write keeps the text in the
field (ADR 021, P3 and P7)."
```

---

### Task 5: Process the queue (P5, P6)

**Files:**
- Create: `web/src/features/transactions/capture-queue-page.tsx`
- Create: `web/src/features/transactions/use-capture-queue-notice.tsx`
- Modify: `web/src/features/transactions/api.ts` (`capturePreviewQuery`)
- Modify: `web/src/features/transactions/capture-page.tsx` (queued mode)
- Modify: `web/src/features/transactions/search.ts` (`validateCaptureSearch`)
- Modify: `web/src/features/transactions/index.ts` (exports)
- Modify: `web/src/app/router.tsx` (`captureRoute.validateSearch`; new `captureQueueRoute`)
- Modify: `web/src/app/shell/app-frame.tsx` (calls `useCaptureQueueNotice()`)
- Modify: both catalogs
- Test: `web/src/features/transactions/capture-queue-page.test.tsx`

**Interfaces:**
- Consumes: Tasks 1 to 4; `meQuery` (`@/features/session`).
- Produces:
  - `capturePreviewQuery(api, text, defaultAccountId, referenceDate: string | null)`: adds `reference_date` to the body and `referenceDate` to the query key when not null. Update its other callers with `null` (`grep -rn "capturePreviewQuery(" web/src`).
  - `validateCaptureSearch(raw: Record<string, unknown>): { queued: string | undefined }` using the `uuid` helper of `search.ts`.
  - Route `/_authed/transactions/queue`, component `CaptureQueuePage`; `captureRoute` gains `validateSearch: validateCaptureSearch`.
  - `useCaptureQueueNotice(): void`.

Strings:

| Key | en | pt-BR |
|---|---|---|
| `queue.title` | Offline captures | Lançamentos offline |
| `queue.subheading` | Texts written without the server. Each opens in the text capture with the day it was written. | Textos escritos sem o servidor. Cada um abre no lançamento por texto com o dia em que foi escrito. |
| `queue.process` | Review | Revisar |
| `queue.empty` | No offline capture waiting. | Nenhum lançamento offline na fila. |
| `queue.pending` | {count} offline captures waiting | {count} lançamentos offline na fila |
| `queue.open` | Open queue | Abrir fila |
| `capture.queuedFrom` | Text written on {date}. Its dates count from that day. | Texto escrito em {date}. As datas dele contam a partir desse dia. |
| `capture.queue` | Offline queue ({count}) | Fila offline ({count}) |

Behavior:
  - `CaptureQueuePage` (`Page width="full"`): header `queue.title` / `queue.subheading`; a `List variant="separated"` with `ListSection label={t("queue.title")}`; `ListEmpty` = `queue.empty`; per entry of `readQueue(me.id)`: label = text, description = `queue.writtenOn` with `formatDate`, actions `Button size="sm"` = `queue.process` navigating to `{ to: "/transactions/capture", search: { queued: entry.id } }` and `Button size="sm" variant="ghost" tone="secondary"` = `queue.discard` calling `removeQueued` and refreshing state. `me` comes from `useQuery(meQuery(api))`.
  - `CapturePage` with `queued` set and found by `findQueued`: initial text = entry text; initial default account = `entry.defaultAccountId ?? readDefaultAccount()`; `referenceDate = entry.capturedOn`; the session draft is neither read nor written (`readCaptureDraft` and `writeCaptureDraft` skipped); `AccountField date` = `entry.capturedOn`; `PageHeaderDescription` = `capture.queuedFrom` with `formatDate(entry.capturedOn, locale)`. After `record.mutateAsync` succeeds: `removeQueued(entry.id)`, then the existing toast, then `navigate({ to: "/transactions/queue" })`. A failed record keeps the entry (no removal before success). A `queued` id not found: the page behaves as without `queued`.
  - `CapturePage` without `queued`: when `readQueue(me.id).length > 0`, `PageHeaderActions` gains a second `ButtonLink variant="outline" tone="secondary"` = `capture.queue` to `/transactions/queue`, built like the existing "use the form" link with its click handler.
  - `useCaptureQueueNotice`: with `me.data?.id` defined, count `readQueue(id).length` on mount, on `window` `online`, and on `document` `visibilitychange` to `visible`; when the count is above 0 and differs from the last count shown, `toast.show({ title: t("queue.pending", { count }), actions: <Button size="sm" variant="ghost" tone="secondary" onClick={...navigate to /transactions/queue}>{t("queue.open")}</Button> })`. Remove both listeners on unmount. `AppFrame` calls it once at the top of the component.

- [ ] **Step 1: Add the strings** to both catalogs.

- [ ] **Step 2: Write the failing tests** `capture-queue-page.test.tsx`. Reuse the `groceries` line fixture and the capture routes of `capture-page.test.tsx` (copy the fixture object; keep its `date` field `"2026-10-15"` for this file):

```tsx
const batchRoute = vi.fn(() => json(201, { items: [{ id: "t1" }] }));

function routes(preview: (req: Request) => Promise<Response> | Response) {
  return fakeApi({
    ...sharedRoutes,
    "POST /api/v1/capture/preview": preview,
    "POST /api/v1/capture/suggestions": () => json(200, { items: [] }),
    "POST /api/v1/transaction-batches": batchRoute,
  });
}

beforeEach(() => {
  localStorage.clear();
  batchRoute.mockClear();
});

it("lists only the signed-in user's entries", async () => {
  enqueueCapture({ userId: 1, text: "mercado 230 itau", defaultAccountId: null, capturedOn: "2026-10-15" });
  enqueueCapture({ userId: 2, text: "someone else", defaultAccountId: null, capturedOn: "2026-10-15" });
  await renderApp("/transactions/queue", { fetch: routes(() => json(200, { lines: [] })) });
  expect(await screen.findByText("mercado 230 itau")).toBeInTheDocument();
  expect(screen.queryByText("someone else")).toBeNull();
});

it("previews a queued text against the day it was written and removes it once recorded", async () => {
  const queued = enqueueCapture({ userId: 1, text: "mercado 230 itau", defaultAccountId: null, capturedOn: "2026-10-15" });
  const bodies: unknown[] = [];
  const { router } = await renderApp("/transactions/queue", {
    fetch: routes(async (req) => {
      bodies.push(await req.json());
      return json(200, { lines: [groceries] });
    }),
  });
  await userEvent.click(await screen.findByRole("button", { name: catalogEn["queue.process"] }));
  await waitFor(() => {
    expect(bodies).toContainEqual(expect.objectContaining({ text: "mercado 230 itau", reference_date: "2026-10-15" }));
  });
  await userEvent.click(await screen.findByRole("button", { name: /Record 1/ }));
  await waitFor(() => {
    expect(router.state.location.pathname).toBe("/transactions/queue");
  });
  expect(findQueued(queued.id)).toBeUndefined();
});

it("keeps the entry when recording fails", async () => {
  batchRoute.mockImplementationOnce(() => problem(500, "internal"));
  const queued = enqueueCapture({ userId: 1, text: "mercado 230 itau", defaultAccountId: null, capturedOn: "2026-10-15" });
  await renderApp(`/transactions/capture?queued=${queued.id}`, {
    fetch: routes(() => json(200, { lines: [groceries] })),
  });
  await userEvent.click(await screen.findByRole("button", { name: /Record 1/ }));
  await waitFor(() => {
    expect(batchRoute).toHaveBeenCalled();
  });
  expect(findQueued(queued.id)).toBeDefined();
});

it("announces waiting entries in the shell", async () => {
  enqueueCapture({ userId: 1, text: "uber 12", defaultAccountId: null, capturedOn: "2026-10-15" });
  enqueueCapture({ userId: 1, text: "padaria 8", defaultAccountId: null, capturedOn: "2026-10-16" });
  await renderApp("/transactions/capture", { fetch: routes(() => json(200, { lines: [] })) });
  expect(await screen.findByText("2 offline captures waiting")).toBeInTheDocument();
});
```

Check the exact response bodies of `POST /api/v1/capture/suggestions` and `POST /api/v1/transaction-batches` against the routes already used in `capture-page.test.tsx` and use the same shapes. The record button's name comes from `capture.record` (`Record {count}`).

- [ ] **Step 3: Run** `cd web && pnpm exec vitest run src/features/transactions/capture-queue-page.test.tsx`
Expected: FAIL (no route `/transactions/queue`).

- [ ] **Step 4: Implement** the interface block and the behavior list, in this order: `api.ts`, `search.ts`, `capture-queue-page.tsx`, `capture-page.tsx`, `use-capture-queue-notice.tsx`, `index.ts`, `router.tsx`, `app-frame.tsx`.

- [ ] **Step 5: Run** the new test file and `src/features/transactions/capture-page.test.tsx`. Expected: PASS; the existing capture tests keep passing.

- [ ] **Step 6: Run** `make web-check`. Expected: exit status 0.

- [ ] **Step 7: Commit**

```bash
git add web/src
git commit -m "feat(web): turn queued captures into transactions" -m "/transactions/queue lists the signed-in user's texts written offline.
Review opens one in the text capture, which previews it against the
day it was written and removes it only after the batch is recorded.
The shell announces waiting texts on start, on reconnection and when
the page becomes visible (ADR 021, P5 and P6)."
```

---

### Task 6: Service worker (P1, P2)

**Files:**
- Create: `web/public/sw.js`
- Create: `web/src/app/service-worker.ts`
- Test: `web/src/app/service-worker.test.ts`, `web/src/app/sw-script.test.ts`
- Modify: `web/src/main.tsx`
- Modify: `web/eslint.config.*` (globals of `public/sw.js`)
- Modify: `internal/platform/spa/spa.go`
- Test: `internal/platform/spa/spa_test.go`

**Interfaces:**
- Produces: `export function registerServiceWorker(env: { prod: boolean; secure: boolean; container: { register(url: string): Promise<unknown> } | undefined }): void`. `main.tsx` calls it with `{ prod: import.meta.env.PROD, secure: window.isSecureContext, container: navigator.serviceWorker }`.

- [ ] **Step 1: Write `web/public/sw.js`**

```js
// Service worker of the installed application (ADR 021, P1). It keeps the shell and its files so
// the application opens without the server; no /api/ answer is ever stored.
const SHELL = "equori-shell-v1";
const FILES = "equori-files-v1";
const STATIC = ["/boot.js", "/boot.css", "/manifest.json", "/icon.svg"];

function assetsOf(html) {
  return [...new Set(html.match(/\/assets\/[^"'\s)]+/g) ?? [])];
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const page = await fetch("/", { cache: "no-store" });
      const html = await page.clone().text();
      await (await caches.open(SHELL)).put("/", page);
      await (await caches.open(FILES)).addAll([...STATIC, ...assetsOf(html)]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== SHELL && name !== FILES) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

// Network first; a new index.html replaces the stored one and drops the files of the old build.
async function navigate(request) {
  const shell = await caches.open(SHELL);
  try {
    const page = await fetch(request);
    if (page.ok) {
      const html = await page.clone().text();
      const stored = await shell.match("/");
      if (stored === undefined || (await stored.text()) !== html) {
        await caches.delete(FILES);
        await shell.put("/", page.clone());
      }
    }
    return page;
  } catch (error) {
    const stored = await shell.match("/");
    if (stored !== undefined) return stored;
    throw error;
  }
}

async function file(request) {
  const files = await caches.open(FILES);
  const hit = await files.match(request);
  if (hit !== undefined) return hit;
  const answer = await fetch(request);
  if (answer.ok) await files.put(request, answer.clone());
  return answer;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") event.respondWith(navigate(request));
  else if (url.pathname.startsWith("/assets/") || STATIC.includes(url.pathname))
    event.respondWith(file(request));
});
```

- [ ] **Step 2: ESLint.** Add beside the `public/boot.js` block:

```js
  {
    // The service worker, a classic script in its own global scope (ADR 021, P1).
    files: ["public/sw.js"],
    languageOptions: {
      sourceType: "script",
      globals: { self: "readonly", caches: "readonly", fetch: "readonly", URL: "readonly" },
    },
  },
```

- [ ] **Step 3: Write the failing script test** `web/src/app/sw-script.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

const source = readFileSync(fileURLToPath(new URL("../../public/sw.js", import.meta.url)), "utf8");
const origin = "https://equori.test";

type Listener = (event: Record<string, unknown>) => void;

// In-memory CacheStorage with string keys (absolute URLs).
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const key = (r: Request | string) => new URL(typeof r === "string" ? r : r.url, origin).href;
  const open = (name: string) => {
    const store = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, store);
    return {
      match: (r: Request | string) => Promise.resolve(store.get(key(r))?.clone()),
      put: (r: Request | string, res: Response) => {
        store.set(key(r), res);
        return Promise.resolve();
      },
      addAll: async (urls: string[]) => {
        for (const u of urls) store.set(key(u), await server(new Request(new URL(u, origin))));
      },
    };
  };
  return {
    stores,
    api: {
      open: (name: string) => Promise.resolve(open(name)),
      keys: () => Promise.resolve([...stores.keys()]),
      delete: (name: string) => Promise.resolve(stores.delete(name)),
    },
  };
}

let pages: Record<string, string>;
let online: boolean;
function server(req: Request): Promise<Response> {
  if (!online) return Promise.reject(new TypeError("Failed to fetch"));
  const path = new URL(req.url).pathname;
  const body = pages[path] ?? pages["/"];
  return Promise.resolve(new Response(body, { status: 200 }));
}

function load() {
  const listeners: Record<string, Listener> = {};
  const caches = fakeCaches();
  const self = {
    location: new URL(origin),
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  new Function("self", "caches", "fetch", source)(self, caches.api, (r: Request | string) =>
    server(typeof r === "string" ? new Request(new URL(r, origin)) : r),
  );
  const run = async (type: string, extra: Record<string, unknown> = {}) => {
    let waited: Promise<unknown> = Promise.resolve();
    let answered: Promise<Response> | undefined;
    listeners[type]?.({
      ...extra,
      waitUntil: (p: Promise<unknown>) => {
        waited = p;
      },
      respondWith: (p: Promise<Response>) => {
        answered = p;
      },
    });
    await waited;
    return answered;
  };
  const request = (path: string, mode: RequestMode = "cors") =>
    ({ url: origin + path, method: "GET", mode }) as unknown as Request;
  return { caches, run, request };
}

const index = (build: string) =>
  `<script src="/boot.js"></script><script type="module" src="/assets/index-${build}.js"></script>`;

describe("sw.js", () => {
  beforeEach(() => {
    online = true;
    pages = {
      "/": index("a1"),
      "/assets/index-a1.js": "a1",
      "/assets/index-b2.js": "b2",
      "/boot.js": "boot",
      "/boot.css": "",
      "/manifest.json": "{}",
      "/icon.svg": "<svg/>",
    };
  });

  it("stores the shell and the files it names on install", async () => {
    const sw = load();
    await sw.run("install");
    expect([...(sw.caches.stores.get("equori-files-v1")?.keys() ?? [])]).toContain(`${origin}/assets/index-a1.js`);
    expect(sw.caches.stores.get("equori-shell-v1")?.has(`${origin}/`)).toBe(true);
  });

  it("answers a navigation from the stored shell without the server", async () => {
    const sw = load();
    await sw.run("install");
    online = false;
    const answer = await sw.run("fetch", { request: sw.request("/transactions", "navigate") });
    expect(await answer?.text()).toBe(index("a1"));
  });

  it("replaces the shell and clears assets when index.html changes", async () => {
    const sw = load();
    await sw.run("install");
    pages["/"] = index("b2");
    await sw.run("fetch", { request: sw.request("/", "navigate") });
    expect(sw.caches.stores.has("equori-files-v1")).toBe(false);
    online = false;
    const answer = await sw.run("fetch", { request: sw.request("/", "navigate") });
    expect(await answer?.text()).toBe(index("b2"));
  });

  it("never answers an /api/ request", async () => {
    const sw = load();
    await sw.run("install");
    expect(await sw.run("fetch", { request: sw.request("/api/v1/me") })).toBeUndefined();
  });
});
```

If `new Function` is refused by a lint rule (`no-new-func`), add `// eslint-disable-next-line no-new-func -- the service worker is a classic script; the test runs it in a scope of fakes.` above that line.

- [ ] **Step 4: Run** `cd web && pnpm exec vitest run src/app/sw-script.test.ts`. Expected: PASS when Step 1 is in place; to see it fail first, run it before Step 1 (it fails reading `public/sw.js`). Each assertion must be shown failing once: change `"equori-files-v1"` in the third test to `"equori-files-v0"`, run, observe the failure, restore.

- [ ] **Step 5: Write the failing registration test** `service-worker.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { registerServiceWorker } from "@/app/service-worker";

describe("registerServiceWorker", () => {
  it("registers /sw.js in a secure production page", () => {
    const register = vi.fn(() => Promise.resolve({}));
    registerServiceWorker({ prod: true, secure: true, container: { register } });
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it.each([
    { prod: false, secure: true },
    { prod: true, secure: false },
  ])("does nothing when prod=$prod and secure=$secure", (env) => {
    const register = vi.fn(() => Promise.resolve({}));
    registerServiceWorker({ ...env, container: { register } });
    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing without service worker support", () => {
    expect(() => {
      registerServiceWorker({ prod: true, secure: true, container: undefined });
    }).not.toThrow();
  });
});
```

- [ ] **Step 6: Implement** `service-worker.ts` (`void env.container.register("/sw.js")` under the three conditions) and call it at the end of `main.tsx`. Run `cd web && pnpm exec vitest run src/app/service-worker.test.ts`. Expected: PASS.

- [ ] **Step 7: Go side (P2).** Add to the table of `TestHandler` in `internal/platform/spa/spa_test.go` a file `"sw.js": {Data: []byte("self")}` in `fsys` and a case for `GET /sw.js` expecting status 200, body `self` and `Cache-Control: no-cache` (extend the table struct with a `cacheControl` field when it has none, and assert it only when non-empty). Run `go test ./internal/platform/spa/`: FAIL on the header. In `spa.go`, extend the first case to `case name == indexName || name == "sw.js":` with the comment `// The browser must see a new service worker on the next load (ADR 008, W11; ADR 021, P2).` Run again: PASS.

- [ ] **Step 8: Check the production build by hand**

Run: `make run-prod` in one terminal; in a Playwright script that launches Chromium and closes it in `finally`, open `http://127.0.0.1:8091/`, wait for `navigator.serviceWorker.ready`, set the context offline (`context.setOffline(true)`), reload, and read the heading. Expected heading: `No connection to the server`. `127.0.0.1` is a secure context, so the worker registers over plain HTTP there. At most one screenshot.

- [ ] **Step 9: Commit**

```bash
git add web/public/sw.js web/src/app/service-worker.ts web/src/app/service-worker.test.ts web/src/app/sw-script.test.ts web/src/main.tsx web/eslint.config.* internal/platform/spa
git commit -m "feat(web): open the installed application without the server" -m "A service worker stores index.html and the files it names, answers a
navigation from the network first and from the stored shell when the
server does not answer, and drops the old build's files when a new
index.html arrives. No /api/ answer is stored; /sw.js is served with
no-cache (ADR 021, P1 and P2)."
```

---

### Task 7: Documents of F4

**Files:**
- Modify: `docs/adr/021-distribution.md` (D7 rules P1 to P9 and P4a, verbatim from the spec)
- Modify: `docs/adr/008-web-interface.md` (dated row after W12)

- [ ] **Step 1:** ADR 021: append the D7 table.
- [ ] **Step 2:** ADR 008 web interface: add `| W13 | Amendment of 2026-10-26. \`/sw.js\` is served with \`Cache-Control: no-cache\`, like \`index.html\`. The service worker stores \`/\`, the files under \`assets/\` that it names, \`/boot.js\`, \`/boot.css\`, \`/manifest.json\` and \`/icon.svg\`, and no \`/api/\` answer. Reason: the installed application opens without the server (ADR 021, D7). |` — check the last W number in the file first and use the next one.
- [ ] **Step 3: Commit** `docs: record the offline capture rules` with a body naming ADR 021 D7 and the ADR 008 row.

---

### Task 8: Phase gate

- [ ] **Step 1:** `make check` — Expected: exit status 0.
- [ ] **Step 2 (Owner):** On a phone, over the HTTPS address of `docs/operations/remote-access.md` (F3) or of any HTTPS setup: install the application, sign in, stop the server, open the application, queue `mercado 30 ontem`, start the server, open the application, review the entry, record it. Expected: one transaction dated the day before the day the text was queued.
- [ ] **Step 3:** Update `.claude/progress/current.md` with every required field; next action: none in the distribution plans.
