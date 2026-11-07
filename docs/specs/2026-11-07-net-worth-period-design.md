# Net worth over a chosen period

The net worth tab of Reports reads a period and states how much the net worth grew in it and where the growth came from. No server change: every figure comes from `/reports/net-worth` and `/reports/categories`.

## Rules

- **NP1 Period.** The header's period control stands on the net worth tab. Without `from` and `to` in the address, the period starts on the first day of the month `months − 1` months before today's month and ends on today (6, 12 or 24 months). Picking a span writes `months` and removes `from` and `to`; picking a period in the header writes `from` and `to`, and the span control shows no segment.
- **NP2 Series.** The chart and the table hold one point per month that starts in `[from, min(to, today)]`, valued at the earliest of the month's last day, `to` and today.
- **NP3 Change.** The opening net worth is valued on the day before `from`; the closing one at the last point. The change is closing minus opening; the percent is the change over the magnitude of the opening, absent when the opening is zero.
- **NP4 Sources of the change.** The result is income minus expenses of `[from, closing date]` in the accrual view, the sum of every `total` of `/reports/categories` for each class, read in runs of at most 366 days. The rest of the change (valuation, exchange, adjustments) is the change minus the result. Both are drawn only when the valuation currency is the base currency, the currency of `/reports/categories`.
