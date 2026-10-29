# Phone scope (ADR 027)

Spec: `docs/adr/027-phone-scope.md`. Each task is one commit. Web tests run with `pnpm exec vitest run <files>` from `web/`; `make web-check` closes each slice.

Baseline on 2026-10-29 before task 1: 256 files, 1687 tests, 14 failing in 3 files that hold uncommitted work of another session.

## Slice 1: rule and gate

1. **docs**: amend `docs/domain/01-vision.md` §1.10, `docs/contributing/mobile.md` (scope section above M1; M1 "Bulk or setup" row removed), `web/CLAUDE.md` "Phone screens", ADR 022 D1 note. Commit `docs: limit the phone to the routes of adr 027`.
2. **gate** (S2, S3, S4): `staticData: { phone: true }` on the S3 routes, `StaticDataRouteOption` augmentation in `router.tsx`, `app/shell/phone-gate.tsx` around the `Outlet` of `AppFrame`, `app/shell/wide-screen-notice.tsx`, catalog keys `phone.wide.*` in `catalog.en.ts` and `catalog.pt-BR.ts`. Test first in `app/shell/phone-gate.test.tsx`: each S3 route renders its page at 390 px; `/planning`, `/categories`, `/accounts/new` render the notice at 390 px and the page at 1280 px. Phone tests of desktop-only routes that fail move to 1280 px or assert the notice; the commit body cites ADR 027 S4.
3. **dock** (S6): `Destination.phone` gains `"none"`; goals, planning, instruments, portfolio, reports, calculators, categories become `"none"`; `phone-dock.tsx` and `more-sheet.tsx` skip them. Test first in the dock test.

## Slice 2: tabs (S5)

4. `account-record.tsx`: on the phone the tab list holds `activity` only and a desktop-only `search.tab` shows `activity`. Test first.
5. `card-record.tsx`: on the phone the tab list omits `cards` and `settings`. Test first.

## Slices 3 to 6: remove phone code (S7)

One task per feature: remove each `compactQuery` branch, `PhoneList`/`PhoneGroup` use and `max-width: 599px` rule of its desktop-only screens, tabs and drawers; move their phone tests to desktop width or delete those that assert only the removed layout, citing ADR 027 S7 in the commit body.

6. planning (`agenda-*`, `budget-page`, `budgets-tab`, `plan-editor`, `schedules-*`, `subscriptions-tab`)
7. portfolio (`income-events-tab`, `portfolio-*`, `realized-results-tab`, `year-totals-table`)
8. instruments (`instrument-positions`, `instruments-grid`, `price-table`)
9. categories (`aliases-drawer`, `categories-page.module.css`, `payees-page`, `rule-editor`, `tags-page`)
10. goals (`goals.module.css`)
11. accounts setup and tabs (`account-form-header`, `batch-page`, `connection-links`, `imports-tab`, `institutions-page`, `link-drawer`, `positions-tab`, `reconciliation-tab`, `scheduled-tab`)
12. cards tabs (`card-settings-tab`, `plastic-cards-tab`)
13. `ui/phone-list.tsx` and `ui/phone-group.tsx`: delete when no caller remains.

## Slice 7: links

14. Audit links from phone routes to desktop-only routes (overview widgets, transaction detail, settings). Each link either stays (the notice of S4 answers it) or is hidden on the phone; the decision is listed in the commit body.
