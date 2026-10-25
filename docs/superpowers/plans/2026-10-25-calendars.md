# Calendars and holidays (web roadmap item 13)

Scope: `listCalendars`, `listHolidays`. Region rules: ADR 016, `docs/contributing/regions.md`.

## Slice 1: `feat(marketdata): name the user's calendar in the calendar list`
- Test first: `GET /calendars` returns `default` = `br_banking` for region `BR` and `weekend` for `DE`
  (`internal/marketdata/api_test.go`).
- `api/openapi.yaml`: `CalendarList.default`, required, `^[a-z0-9_]{2,40}$`.
- `marketdata` declares the `Profiles` port; `internal/server` composes it with identity.
  `ListCalendars` fills `default` with `DefaultCalendar(region)`.
- Web: the schedule form select opens on `default`, labelled as the region's calendar.
  The request omits `calendar` when it equals `default`.

## Slice 2: `feat(web): list the calendars and holidays in the settings`
- Read-only settings section "Calendars" (`calendar.` catalog prefix).
- List: `default` first with a region mark, then the API order. Each entry shows the label
  and the weekend days named by `Intl`.
- Selecting a calendar lists the holidays of a year (date, name, source) grouped by month.
  The year defaults to the current year of the app clock, with previous and next.
- Calendar and year live in search params.
- Links from the schedule page and the schedule form select to the section.
- Empty year: states that only weekends are non-business days.
- `docs/web-roadmap.md`: item 13 Delivered (section, Summary table, snapshot).

## Verification
- Slice 1: `go test` of marketdata, planning, server; `vitest` of the schedule form.
- Slice 2: vitest of the section, `make check` once, Playwright smoke (1280 px and 390 px).
