# ADR 039: Aggregator connect dialog

- Status: accepted
- Date: 2026-11-24

## Context

A bank connected at the portal of the aggregator reaches equori only through an item of the aggregator application. For personal use the aggregator lists no items (`GET /v2/items` answers 403), so a person had to open the aggregator's developer site for each bank, connect it there, copy the item id and register it. No screen took that id.

Pluggy refuses `POST /items` on a free subscription: 400 `CREATE_ITEMS_API_FREE_DISABLED`, "Free subscription can only create items through our Connect Widget" (2026-11-24). `POST /connect_token` answers 200 on the same subscription.

## Decision

- `POST /integrations/{id}/connect-token` asks the aggregator for a short-lived token with the sealed credentials. The credentials never reach the browser. The role is `write`; no assistant tool covers it.
- The web opens the aggregator's own dialog with that token. Pluggy's is `pluggy-connect-sdk` (MIT), a dependency of `web/` pinned in `package.json` and bundled by Vite, imported on demand when a person opens the dialog. No script is loaded from a CDN.
- The dialog offers the MeuPluggy connector only, the one of personal use.
- The page policy gains `frame-src` with the origins of the aggregators (`Aggregator.ConnectOrigin`), and no other directive changes. The SDK injects a `<style>` element, which the policy blocks; the application adopts the text of that element as a constructed stylesheet, so `style-src` stays closed to inline styles.
- The launcher of each aggregator is an entry of `web/src/features/accounts/connect/connect-launchers.ts`. An aggregator without an entry is not offered.

## Consequences

- A bank takes one login at the aggregator, with no developer site and no copied id. The application and its credentials are still created once per person at the aggregator's developer site.
- The browser contacts the aggregator only when a person presses Connect bank.
- The dialog opened over plain HTTP on a local network address on 2026-11-24. The end of a login, after the person accepts the terms, was not exercised.
