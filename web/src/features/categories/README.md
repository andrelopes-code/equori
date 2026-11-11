# categories

Category tree, categorization rules, payees and tags.

## Routes (`src/app/router.tsx`)

- `/categories`: `CategoriesPage`
- `/categories/rules`: `RulesPage`
- `/categories/rules/new` and `/categories/rules/$id`: `RuleEditorPage`
- `/categories/payees`: `PayeesPage`
- `/categories/tags`: `TagsPage`

Guide topics (`src/navigation/navigation-map.json`): `accounts_and_categories` and `reports` for the tree; `categorization_rules_and_payees` for the rest.

## Endpoints (`api.ts`)

- `GET /reports/categories`
- `POST /accounts`, `PATCH /accounts/{id}`, `PUT /accounts/{id}/parent`, `PUT /accounts/{id}/appearance`
- `POST /accounts/{id}/merge`, `POST /accounts/{id}/close`, `POST /accounts/{id}/reopen`
- `GET`, `POST /rules`; `PUT`, `DELETE /rules/{id}`; `POST /rules/reorder`, `/rules/run`, `/rules/preview`
- `GET /rule-suggestions`; `POST /rule-suggestions/{id}/accept`, `/dismiss`
- `GET /categorization-statistics`, `GET /source-categories`, `PUT /source-categories/{id}`
- `GET`, `POST /payee-aliases`; `PUT`, `DELETE /payee-aliases/{id}`
- `POST /payees`, `PATCH /payees/{id}`, `POST /payees/{id}/merge`
- `GET`, `PATCH`, `DELETE /tags/{name}`, `POST /tags/{name}/merge`

## Folders

- `pages/`: route components, their tests, `validateCategoriesSearch`, `validateRulePrefill`
- `model/`: functions and hooks used by two or more folders (paths, figures, rule sentences)
- `category-tree/`: tree, row menu, share bar
- `category-mark/`: category icon and avatar
- `category-dialog/`: create and edit a category
- `appearance-picker/`: icon and color choice
- `category-picker/`: category selector and recent categories
- `merge-dialog/`: merge of two categories
- `categories-header/`: header shared by the four list pages
- `category-view/`: view control and note
- `category-charts/`: composition chart and its rows
- `figures-row/`: figures row and pending card
- `payees/`: payee dialogs, aliases drawer, actions
- `tags/`: tag dialogs and actions
- `rule-editor/`: rule form: conditions, actions, splits, reading
- `rule-preview/`: preview of what a rule matches
- `rule-list/`: rule list, row actions, summary
- `suggestion-item/`, `coverage/`, `source-categories/`: parts of the rules page
