# Connect a bank from the interface

Status: the owner chose the aggregator's dialog on 2026-11-24. ADR 039 records the decision.

## Problem

`POST /api/v1/connections` has no caller in `web/`. The help and the empty state of Links say that connections are created in the settings, where no such action exists. A bank added at the aggregator's portal does not reach equori: each bank is one item of the aggregator application, and the aggregator does not list items for personal use.

## Approaches

| Approach | Trade-off |
|---|---|
| Discover items by itself | Not possible: `GET /v2/items` of Pluggy is not available to Meu Pluggy accounts. |
| Embed the aggregator's widget (chosen) | No Dashboard step per bank, and the path the aggregator's answer names for a free subscription. Third-party code in the browser (ADR 039). |
| Create the item by the API and open its authorization | Not possible on a free subscription: `POST /items` answered 400 `CREATE_ITEMS_API_FREE_DISABLED` ("Free subscription can only create items through our Connect Widget"), tested on 2026-11-24 with connector 200, which is `oauth: true` without credentials. |
| Dialog that shows where the reference is and takes it | One paste per bank. No change of the API. The Dashboard steps stay. |

## Behavior

CB1. Links has the primary action "Connect bank" in its header and in its empty state. Settings > Integrations has the same action on each integration. Every one opens the dialog at `/accounts/links?connect=<integration id or new>`.

CB2. Without an integration, the dialog states that the credentials come first and leads to Settings > Integrations.

CB3. With an integration, the dialog shows the steps of the integration's aggregator, a link to its portal and the bank's name. Two or more integrations add the choice of one. An aggregator without a launcher states that it offers no connection from here.

CB4. "Continue" asks for the connect token and opens the aggregator's dialog in place of this one. Its item is registered with the bank's name. A closed dialog registers nothing and keeps the name. A failed registration keeps the item while the dialog stays open, and "Try again" sends it without a second login.

CB5. After the connection, the dialog lists the accounts found. "Link accounts" opens the link of the first one; "Connect another bank" empties the form.

CB6. The help page `connect-bank` has the section of this task, and its passage of region BR holds the steps in Meu Pluggy and in the Pluggy Dashboard, with the known mistakes.

CB7. A connection is renamed on Links (`PATCH /connections/{id}`, role `write`) and by the action `rename_connection` of `manage_imports`.

CB8. The help names the symptom "an added bank does not appear", and the credentials dialog and the setup state lead to the section `credentials` of the page. Steps draw external links.

## Cross-cutting questions

- R1: The dialog, portal and steps vary by aggregator. Extension point: `web/src/features/accounts/connect/connect-launchers.ts`, keyed by aggregator id; on the server, `ConnectToken` and `ConnectOrigin` of `Aggregator`.
- R2: An aggregator without a launcher shows the neutral sentence. A region without a help passage reads the neutral page.
- R3: Does not apply: no stored value set.
- R4: Row added to `docs/contributing/regions.md`.
- R5: Keys `links.connect.*` in pt-BR and en.
- R6: Does not apply: no number and no date.
- C1 to C4: Does not apply: no amount.
- T1, T2: Does not apply: no date.
- B1, D1, D2: Does not apply: no table and no schema change.
- B2: `createConnectToken` is `write`; `TestConnectToken` covers read, write and no membership. `createConnection` stays `write`.
- B3: Does not apply: no setting.
- D3, D4, D5: Does not apply: a connection starts with every account pending and imports nothing.
- S1: `renameConnection`, covered by `manage_imports`. `createConnectToken`, excluded from the tools as `-secret`. No new problem code.
- S2: Does not apply: Links is desktop-only (ADR 027).
- S3: Article `imports_and_bank_connections`.
- S4: The assistant keeps no access: a connection stays the owner's act.
- X1: Does not apply: the API scenarios of P6 cover the operation; the dialog has web tests.
- X2: A test with an aggregator that has no launcher; `help-pages.test.ts` reads the page for region US.
