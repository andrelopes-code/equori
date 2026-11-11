# calculators

Financial calculators that run in the browser. Rates of the indexes come from the API.

## Routes

Defined in `web/src/app/router.tsx`.

- `/calculators`: `CalculatorsPage`, the list of calculators.
- `/calculators/$id`: `CalculatorPage`, one calculator. The search string is checked by `validateCalculatorSearch`.

## Endpoints (`api.ts`)

- `GET /indexes`
- `GET /indexes/{id}/rates`
- `GET /indexes/{id}/expectations`

## Guide topics

`investments` and `reports` (`web/src/navigation/navigation-map.json`).

## Folders

- `pages/`: the components a route renders.
- `calculator-frame/`: the frame, the method section, the result table and the shared styles of every calculator.
- `fields/`: the input fields and the money hook shared by the calculators.
- `result/`: the lead figure and the list that show a result.
- `rate-source/`: the index catalog, the index rates, the floating rate and the rate source fields.
- `model/`: pure functions used by two or more folders (the calculator catalog, the search string, rate, round, solve, duration, credit and plan maths).
- `cash-or-installments-calculator/`: cash against installments.
- `compound-calculator/`: compound interest and its simulation.
- `correction-calculator/`: correction of a value by an index.
- `credit-cost-calculator/`: total cost of a credit.
- `debt-payoff-calculator/`: debt payoff, with its maths, region rules and rows.
- `financing-calculator/`: financing, with its annuity and region rules.
- `fixed-income-calculator/`: fixed income, with its maths and region rules.
- `own-or-rent-calculator/`: owning against renting.
- `rates-calculator/`: conversion between rates.
- `recurring-cost-calculator/`: cost of a recurring expense.
