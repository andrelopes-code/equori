# forecast

No route and no component: pure functions that estimate future balances (`index.ts` exports `forecastDays`, `forecastMonth`, `variableForecast`, `seriesKey` and their types).

Files: `forecast-days.ts` (daily balance forecast), `forecast-month.ts` (the current month and the month after it, chained), `variable-forecast.ts`, `recurring-series.ts`, `atypical-fence.ts`, `quantile.ts`, `series-key.ts`. Each has its test beside it.
