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

`/reports/categories`, `/accounts` (create, update, parent, appearance, merge, close, reopen), `/rules` (list, create, update, delete, reorder, run, preview), `/rule-suggestions` (list, accept, dismiss), `/categorization-statistics`, `/source-categories`, `/payee-aliases`, `/payees` (create, update, merge), `/tags/{name}` (read, update, merge, delete).

## Folders

- `pages/`: route components, their tests, `validateCategoriesSearch`, `validateRulePrefill`
- `model/`: functions and hooks used by two or more folders
- `category-tree/`: tree, row menu, share bar
- `category-mark/`: category icon and avatar
- `category-dialog/`: create and edit a category
- `appearance-picker/`: icon and color choice
- `category-picker/`: category selector, recent categories
- `merge-dialog/`: merge of two categories
- `categories-header/`: header of the four list pages
- `category-view/`: view control and note
- `category-charts/`: composition chart and its rows
- `figures-row/`: figures row and pending card
- `payees/`: payee dialogs, aliases drawer, actions
- `tags/`: tag dialogs and actions
- `rule-editor/`: rule form: conditions, actions, splits, reading
- `rule-preview/`: preview of what a rule matches
- `rule-list/`: rule list, row actions, summary
- `suggestion-item/`, `coverage/`, `source-categories/`: parts of the rules page
