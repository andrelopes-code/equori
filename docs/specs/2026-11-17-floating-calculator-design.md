# Floating calculator

Status: accepted. The owner chose concept A (expression) of the mock of 2026-11-17 and fixed the scope on the same day: a window that floats over any screen, moved by dragging, opened by a key and by a command of the navigation column.

## 1. Intent

A user who reads a screen (a report, a statement, a list of transactions) meets figures to add, divide or compare. The calculator is a window above the page that holds nobody: the page under it stays readable and usable, and the account stays on the window while the user moves between screens.

## 2. Goals, non-goals

Goals:

- G1. A window opened and closed by the key `C`, by the command "Calculator" of the navigation column and by the command menu.
- G2. The whole account is typed and corrected on one line; its result is written on every change.
- G3. The arithmetic is exact: no binary floating point takes part in a result.
- G4. The window is moved by the pointer and by the keyboard, never leaves the visible area, and returns to its last place.
- G5. Every key of the window has a keyboard equivalent; the window has a name, a visible focus, and the checks of forced colours and reduced motion of an element of the application's own.

Non-goals: resizing, minimizing, a history of accounts, sending a result to a field, a phone form, currency or unit conversion, scientific functions.

## 3. Approaches

- A. Expression line with a live result (chosen). The account is visible and editable; costs a parser.
- B. Pocket calculator: one number at a time, each operator runs the account before it. Less code; a wrong number in the middle restarts the account; no parentheses.
- C. Strip: one line without keys. Covers 42 px of the page; the pointer cannot type a number.

## 4. Rules

### Opening

- K1. The key `C` opens the window and, when it is open, closes it. The key follows `useKeyShortcut`: no effect inside a field, with a modifier, or while a dialog or menu is open.
- K2. The navigation column holds a fourth command, "Calculator", with the legend `C`; the rail holds its icon. The command menu holds the item "Calculator" in the group of actions.
- K3. Opening moves the focus to the account. `Escape` inside the window closes it. Closing returns the focus to the element that held it before the window opened.
- K4. The window exists from 1024 px (the layout with the navigation column). Below it, neither the key nor a command opens it.
- K5. The account typed and the place of the window are kept while the window is closed and while the route changes. The place is also kept per browser (`localStorage`, key `equori.calculator`).

### Window

- K6. The window is a `section` with the name "Calculator". It is not a dialog: it draws no scrim, traps no focus and leaves the keys `N` and `A` of the shell working.
- K7. The first place is the bottom end corner, `--slotted-space-8` from each edge.
- K8. The bar is the handle. A press on the bar that moves drags the window. The grip of the bar takes the focus; an arrow key moves the window 16 px, and 64 px with `Shift`.
- K9. The window stays whole inside the visible area. A drag and a keyboard move hold the place in code (`clampPlace`). A stored place and a browser window that became smaller are held by the stylesheet: the place is a translation limited to the area minus the window's own size.

### Account

- K10. The account is a text field of at most 60 characters. It accepts digits, the decimal separator of the active tag, `+`, `-`, `*`, `x`, `/`, `(`, `)` and `%`. It writes `*` and `x` as `×`, `/` as `÷` and `-` as `−`. Any other character is dropped, the grouping separator of the tag included, so a pasted `1.200,50` reads as the number it is.
- K11. The integer digits of each number are written in groups of three with the grouping separator of the tag, and an operator between two values stands between two spaces, on every change. The caret keeps its place after the same character. A separator or a space is decoration: erasing one erases the digit or the operator beside it.
- K12. A typed `.` writes the decimal separator of the tag, so the decimal key of a numeric keypad works in every tag.
- K12a. The account is always one the result can read. An operator typed after an operator replaces it; a minus stays after `×`, `÷` and `(` as the sign of the next number. A closing parenthesis is accepted only for one that is open and has a value. A number holds one decimal separator and no leading zero. A number or an opening parenthesis written after a value multiplies it: `2(3 + 4)` is written `2 × (3 + 4)`.
- K13. `Enter` or `=` replaces the account by its result, when the result is a number. The next key continues from it.

### Result

- K14. Operators: `×` and `÷` before `+` and `−`; parentheses; a minus before a number or a parenthesis negates it.
- K15. Percent: `a + b%` is `a + a × b ÷ 100` and `a − b%` is `a − a × b ÷ 100`; in any other place `b%` is `b ÷ 100`.
- K16. An account that ends in an operator or leaves a parenthesis open is read up to its last complete part: `12 +` reads as `12`, `2 × (3 + 4` as `2 × (3 + 4)`.
- K17. The result is written with at most 10 decimal places and at most 15 significant digits, rounded half away from zero, without trailing zeros, grouped as the tag groups, with the minus sign U+2212.
- K18. A division by zero writes "Division by zero". A result whose integer part exceeds 12 digits writes "Number too large". Both are words in the danger tone, without an icon.
- K19. An empty account writes `0` in the muted tone.
- K20. A result above 12 characters takes the 3xl size in place of 4xl; with K17 its longest text, 20 characters, fits the line.

### Keys and copy

- K21. A key of the window writes its character at the caret, in place of the selection. `C` empties the account. The erase key removes the selection or the character before the caret. A press with the pointer anywhere in the window but the account leaves the focus on the account, with its caret and selection.
- K22. The parenthesis key opens a parenthesis when none is open or when the character before the caret is an operator or an opening parenthesis; otherwise it closes one.
- K23. The copy button, drawn when the result is a number, copies the result without grouping separators. Its icon becomes a check until the result changes.

### Privacy

- K24. Privacy mode does not hide the calculator: its numbers are typed by the user, not read from the book.

## 5. Structure

`web/src/app/shell/calculator/`:

| File | Content |
|---|---|
| `rational.ts` | Exact fractions over `BigInt`: read a decimal, add, subtract, multiply, divide, write a rounded decimal (K17). |
| `evaluate.ts` | A recursive descent parser over `rational.ts` (K14 to K16, K18). |
| `account-text.ts` | The two forms of the account, logical and drawn: read, normalize (K10, K12a), draw with the caret (K11), the edit of the field (K12), the result text (K17), the parenthesis choice (K22). |
| `window-place.ts` | Clamp of a place to the visible area; read and write of the stored place (K5, K9). |
| `use-account.ts` | State of the account and the commands of the keys (K13, K21 to K23). |
| `use-window-drag.ts` | Pointer and keyboard moves (K8, K9). |
| `use-open-focus.ts` | Focus on opening and on closing (K3). |
| `use-calculator-open.ts` | The open state and the key `C` (K1, K4). |
| `key-rows.ts` | The twenty keys, in reading order. |
| `calculator-window.tsx`, `calculator-bar.tsx`, `calculator-display.tsx`, `calculator-keys.tsx`, `calculator.module.css` | The element, drawn as the approved mock. |

`desktop-nav/nav-command.tsx` draws one command of the navigation column, open or narrowed; the four commands use it.

The window is an element of the application's own. The families read and what each lacks: `Dialog` (`modal={false}`) centres its panel and has no handle to move it; `Popover` is anchored to its trigger and closes on an outside press; `Drawer` and `DetailPanel` are fixed to an edge.

The approved mock is the contract of the look (`docs/superpowers/plans/assets/floating-calculator/`, local): 20rem wide, a bar of 2rem, the account on one line of md text, the result on one line of 4xl, twenty keys of 3rem in four columns, the panel fill with the strong border and `--slotted-shadow-lg`. The account is a native field, so its text has one colour: the mock of round 1 tinted the operators, and round 2 removed the tint.

## 6. Tests

- `rational.test.ts`, `evaluate.test.ts`: each rule K14 to K18 with exact expected texts, among them `0,1 + 0,2 = 0,3`, `1 ÷ 3 × 3 = 1` and `1.234.567,89 × 12 ÷ 7 − 98.765,43 = 2.017.636,66714286`.
- `account-text.test.ts`: K10, K11, K12, K12a, K17, K22 in the tags `pt-BR` and `en-US`.
- `window-place.test.ts`: K9 and the stored place.
- `calculator-window.test.tsx`: K3, K5, K8, K11, K13, K18 to K23.
- Browser check of 2026-11-17 on the running application: K7, the pointer drag of K8, and K9 against a smaller browser window. jsdom lays nothing out, so no unit test measures them.
- `app-frame.test.tsx`: K1, K2, K4, K5, K6.

## 7. Cross-cutting questions

- R1: The decimal and grouping separators of a number vary by tag. They come from `Intl` through `numberFormatter` (`web/src/i18n/format.ts`); no region extension point is involved.
- R2: A tag without an implementation of its own gets what `Intl` answers for it.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: `calculator.title`, `calculator.key`, `calculator.open`, `calculator.close`, `calculator.move`, `calculator.account`, `calculator.result`, `calculator.copy`, `calculator.copied`, `calculator.erase`, `calculator.clear`, `calculator.parentheses`, `calculator.divisionByZero`, `calculator.tooLarge`, each with pt-BR and en text.
- R6: The account and the result, written with the separators of the active tag and the minus sign of `format.ts`.
- C1: Does not apply: the calculator stores no amount; its numbers carry no currency.
- C2: Does not apply: no amount of the book is added or compared.
- C3: Does not apply: no account, instrument or index is read.
- C4: Does not apply: no currency is displayed; K24 states the privacy rule.
- T1: Does not apply: no date.
- T2: Does not apply: no calendar.
- B1: Does not apply: no table.
- B2: Does not apply: no operation.
- B3: The place of the window is a browser setting (`localStorage`).
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: Does not apply: no fact changes.
- D4: Does not apply: nothing is written from a bank, a file or a model.
- D5: Does not apply: no diagnostic field.
- S1: Does not apply: no operation.
- S2: Not on a phone (K4): below 1024 px there is no navigation column, and a drag competes with the scroll gesture.
- S3: The article `getting_started.md` states the key, the command and what the window does.
- S4: No: the assistant computes through its own tools.
- X1: None: the feature reads and writes nothing of the book.
- X2: `account-text.test.ts` runs every case in `en-US` and in `pt-BR`.
