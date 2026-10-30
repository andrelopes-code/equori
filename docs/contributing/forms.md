# Form screens

A form screen is a page, drawer or dialog whose job is to write one record. Every form of `web/` answers this guide. Mandatory reading before writing or changing a form.

Rules marked with a Slotted ID (FM-06, LA-05) are in `web/node_modules/@slotted/react/dist/docs/guidelines/`. The sources behind the other rules are listed at the end. Rules marked equori are decisions of this application. Slotted issue #19 proposes these rules for the library's `forms.md`, and issues #20, #21 and #22 the primitives that `ui/field-width`, `ui/form-layout` and `ui/form-section` stand in for. Until a release carries them, this file is the rule.

## F1 · One column at a bounded measure

- The fields of a form stand in one column, top to bottom, in the order the reader answers them (Baymard, CXL).
- The column is at most 40rem wide (equori), drawn by `FormLayout` (`ui/form-layout`). A field never spans the page's whole measure.
- A form page keeps `width="wide"` for its header and footer (docs/contributing/web.md, "Page width"); the column inside starts at the page's start edge.

## F2 · Two fields share a row only when they are one answer

- Two fields share a row only when they are parts of one value: a start and an end, a frequency and its interval, an amount and its unit (Baymard).
- The fields of a row keep their own widths and stand 1rem apart: a field with a width step stops at it and the next starts beside it. A row is never split into equal halves that leave a hole after a short field.
- Unrelated fields never share a row to fill width. The pair is a `FormRow` (`ui/form-row`) and shares its top (LA-05).
- Below 600 px of the form's width every row is one field per line.

## F3 · A field's width says what it expects

The width of a control follows the length of its expected answer (Baymard, Queensland Government Design System). A class of `ui/field-width.module.css`, set on the control, writes the step:

| Step     | Width            | Holds                                                                                                                              |
| -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `short`  | 6rem             | an integer up to 4 digits: a day of the month, an interval, a count, a percentage                                                  |
| `date`   | the picker's own | a date (`DateInput`)                                                                                                               |
| `medium` | 15rem            | an amount in a field, a rate, a currency, a day of the month in a row beside another, a choice among short words (frequency, kind) |
| `full`   | the column       | free text, a name, a description, a picker of records (account, category, payee)                                                   |

A field with no step is `full`.

- In a column the class goes on the control; in a `FormRow` it goes on the `Field` (F2). A `ChoiceSelect` takes it through its `className`, which reaches the select's frame.
- A `SegmentedControl` takes the width of its labels: it stands inside an `Inline`, never stretched across the column.
- A currency is chosen by its name and code, never typed as a code (F14.1); a `Select` of codes is a step on the way.

## F4 · One control height

- Every control of a form is drawn at the form's control size (`md`, 34 px in the comfortable density).
- `MoneyInput size="panel"` is reserved for the expense, income and transfer form (`transaction-form`), whose one amount is its first answer (equori). Every other amount, in every other form, is `size="field"` with the `medium` step.

## F5 · Sections group a topic

- A form with more than six fields, or with fields about two or more topics, splits them into `FormSection`s (`ui/form-section`) whose legend names the topic ("Value", "When", "Repetition").
- Two fields stand 1.5rem apart (`--slotted-space-8`), inside a section or not; a label stands 0.25rem above its control (the family's own). The ratio of 6 to 1 makes each label read with the control under it.
- A description or an error stands 0.5rem under its control (`--slotted-space-4`, set in the theme).
- Two sections stand 1.5rem apart, as two fields do, and a section's legend 1.25rem above its first field. The legend is what separates topics.
- A question's legend (a `FieldGroup` of segments or radios) stands 0.375rem above its choices, as a label stands above its control (the theme's, Slotted issue #57).
- `FormLayout` and `FormSection` write these steps; a form writes no gap, margin, `Stack` or `Grid` of its own between fields. A component that renders several fields for reuse in more than one form (`BillingRuleFields`) spaces them with `Stack gap={8}`, the same 1.5rem, and puts pairs in `FormRow`.
- A repeated group (each card of an account, each line of a plan) is one block per item: its fields, then its actions (remove, a toggle of the item) in an `Inline` on the item's last line, then the button that adds an item after the last block.
- A section is named by its legend only. No overline, no step number, no uppercase label.

## F6 · Every question is labelled

- Every control and every set of choices has a visible label above it (Penzo). A segmented control or radio set is a `FieldGroup` whose legend is the question ("Repeats on", "Ends").
- A label is a noun or a short question in sentence case, never a placeholder: a placeholder disappears when the reader types.

## F7 · Necessity is said once, the same way

- Required fields carry no mark; an optional field carries "(optional)" (Silver). The application sets `necessity="optional"` once, through `FieldDefaultsProvider` in `app/slotted-locale.tsx`.
- A section (`FormSection`) is a topic, not a question: its legend carries no necessity word. A set of choices that is a question (`FieldGroup` with segments or radios) states `required` like a field.
- A control outside a submitted form (a calculator, a filter, a setting applied at once) sets `necessity="none"` on its `Field`: nothing is sent, so nothing is optional.
- A field the backend requires sets `required` on its `Field`, so the mark and `aria-required` follow from one fact.

## F8 · Help sits where its question is

| What the reader needs                                                | Where it goes                         |
| -------------------------------------------------------------------- | ------------------------------------- |
| The format or the consequence of one answer, in one sentence         | `FieldDescription` under the control  |
| The definition of a domain term ("business day", "carry over")       | `FieldHelp` beside the label          |
| What the whole record will do: a preview, a summary, a rule in words | the form's aside (`FormLayout aside`) |

- A description is at most one line at the column's width: about 90 characters, measured in the longest translation of the catalog.
- A label takes `FieldHelp` (through `ui/field-title`) when it is a term of accounting, banking or investing ("payee", "withheld", "basis points", "postings"), or when a reader could take it for another field of the form ("fees" beside "taxes", "security account" beside "cash account"). The help defines the term in at most two sentences and names no regional value. A label every reader knows ("Date", "Category", "Description") takes none.
- A `Checkbox` has no `FieldLabel`: the definition of the term it names is its own description, under its label.
- From 62rem of the form's width the aside stands beside the column, 20rem wide, and sticks under the page's chrome (LA-06). Below, it follows the last field.

- A sentence that follows from the answers (the statement a purchase falls on, what a payment leaves unpaid, the total of an installment plan) is the `FieldDescription` of the field whose answer completes it, with `live="polite"`. It is never a `Text` standing between fields: a loose `Text` is 13 px in full ink, reads as a field of its own and is linked to no control.
- A description and an error under the same control: the error comes first, the description stays.
- A placeholder shows an example of the format ("Ex.: Mercado"), never the label's words or an instruction.

## F9 · Rare answers are opened by a choice

A field that is optional and does not change what the record is (a parent account, a note, an external reference) sits in an optional group opened by a choice (FM-06): "Advanced", "Add a note". It is never shown and empty by default. A field the record's kind needs, even when optional, stays in view.

## F10 · The frame says where the reader is and what the form makes

- A form page has `PageBack`, a title that names the record ("New schedule"), and a subheading that says what the record does.
- The actions are the page's footer: the primary action names the result ("Create schedule"), the secondary actions stand before it, and the way out is a ghost button before them: "Cancel" when the form keeps nothing, "Discard" when it keeps a draft that the button also clears (FM-05).
- A form opened from a section of a record page (a new version of a limit or a billing cycle) is a dialog. It never opens inline in a card across the page's measure, where its fields stand short and pinned to the start edge.
- A form of more than eight fields, or one with an aside, is a page, never a dialog. A dialog form follows F4 to F9 inside the dialog's body; F15 replaces F1 to F3 there.
- A dialog's measure is set by its `size` in the theme: `sm` 32rem, for a confirmation or a form of one or two fields; `md` 42rem, for a form; `lg` 48rem.

## F11 · Type in a form has three sizes

| Text                                       | Size                                                    |
| ------------------------------------------ | ------------------------------------------------------- |
| a label, a legend, a control's value       | the control's (`--slotted-control-font-size-md`, 13 px) |
| a description, a counter, a figure's label | `xs` (12 px), muted                                     |
| the amount of `MoneyInput size="panel"`    | `4xl`, the one large figure of an entry form (F4)       |

- No heading, figure or text of another size stands among the fields. A figure the form computes goes in the aside, drawn by `FigureGrid` and `FigureCard`.
- A question's legend is the label's size in semibold, drawn by the theme (Slotted issue #57); a section's legend is one step larger (`--slotted-control-font-size-lg`, `FormSection`).
- A summary drawn inside a field (the kind chosen, the account a value belongs to) uses the description's size, `xs` muted, or the control's: never `Text size="sm"` between the two.

## F12 · Text is not cut

- A label, a legend, a description and the name of a choice wrap to a second line; none is cut with an ellipsis.
- A control whose value can be longer than its step (a record's name, an account, a category) is `full`. A `short` or `medium` step holds only values whose length is known (F3).
- A set of choices whose names do not fit one line is not drawn as tiles or segments: it keeps the few frequent options on the line and moves the others to a menu or a select (F13). A name is never cut.
- A long value that must stay on one line (an account in a trigger) keeps its name and cuts the secondary detail first.

## F13 · The control follows the answer

| The answer                                                  | Control                                                                                                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| one of 2 or 3 short options, each read at a glance          | `SegmentedControl` inside a `FieldGroup` with a legend (F6)                                                                                                                    |
| one of 2 to 6 options that need a sentence each             | `RadioGroup` with a description per option                                                                                                                                     |
| one of 7 to 15 options from a fixed set                     | `Select` (`ChoiceSelect`)                                                                                                                                                      |
| one of more than 15 options, or a set that grows (a record) | `Combobox` with search, and creation where the backend allows it (`CategoryPicker`, `PayeeField`)                                                                              |
| several of a fixed set up to 7                              | `CheckboxGroup`                                                                                                                                                                |
| several of a set that grows                                 | a tags field (`TagsField`)                                                                                                                                                     |
| yes or no, saved with the form                              | `Checkbox` with its consequence as the description                                                                                                                             |
| yes or no that applies at once, outside a submitted form    | `Switch`                                                                                                                                                                       |
| a count or a small integer                                  | `NumberField` with the `short` step                                                                                                                                            |
| a line of free text                                         | `TextField`; several lines expected: `Textarea`                                                                                                                                |
| an amount, a date, a month, a period, an account            | the domain control (F14)                                                                                                                                                       |
| the kind of record, which changes the fields that follow    | its frequent kinds as `SegmentedControl` segments, the others in a menu beside them whose items carry a description and whose trigger names the chosen one (`EntryKindPicker`) |

- A `Select` hides its options behind a press; with 6 options or fewer that each fit a line, radios or a segmented control show them at once (GOV.UK Design System, Select and Radios).
- A switch inside a form that is submitted by a button is a checkbox: a switch says the change applies when it moves (NN/g).

## F14 · A control of the application's own answers what a family cannot

A form builds a control of its own (CP-04, `build-own-element`) when one of these holds, and names it in a comment above the component:

1. **The family makes the reader translate.** The reader would type a unit, a code or a scale the backend uses instead of the one they think in: basis points for a percentage, an ISO 4217 code for a currency name, minor units for an amount.
2. **The answer needs its consequence beside it.** The right choice depends on a fact the family cannot show: an account's balance after the entry, the statement a card purchase falls on, the day a schedule's first occurrence lands.
3. **The answer is frequent and has a shortcut.** Most entries share a value that one press can set, inside the control: today and the two days before it in the date picker's presets.
4. **The value is a domain type of the application.** Money, a period, a month and an account have one control each (docs/contributing/web.md, "Domain controls before families").

A control of the application's own keeps every state of the family it stands beside: the control height (F4), focus ring, `invalid`, `disabled`, `readOnly`, keyboard, forced colours and the field's label and description wiring (`useField`). A look of its own is not a reason to build one.

## F15 · A dialog form is laid out for its own fields

A dialog's body is already a bounded measure (F10), so the column of F1, the pairing of F2 and the width steps of F3 do not apply inside it. Each dialog is laid out from its own fields and checked on screen at its size; no fixed grid answers every dialog (owner review, 2026-10-30; Slotted issue #54).

- Every control fills the space it stands in: no width step inside a dialog. A `DateInput` takes the `fill` class of `ui/field-width.module.css`.
- An `lg` dialog is wider than the 40rem column, so its `FormLayout` sets `fill` and the column takes the body. A component that renders several fields (`RecurrenceFields`) takes `fill` to drop its width steps.
- Two fields whose answers are short (an amount, a date, a count) share a `FormRow` when the pair reads in the order the reader answers: the total beside the minimum, the closing date beside the due date.
- A field whose answer is long or carries actions inside its control (a picker of records, free text, an amount with presets) takes the whole row.
- A dialog never leaves one control short of the body's width beside an empty space.

## Sources

- Baymard Institute, "Avoid Multi-Column Forms": https://baymard.com/blog/avoid-multi-column-forms
- Baymard Institute, "Form Field Usability: Matching User Expectations": https://baymard.com/blog/form-field-usability-matching-user-expectations
- CXL, "Form Field Usability: Should You Use Single or Multi-Column Forms?": https://conversionxl.com/research-study/form-field-usability/
- Queensland Government Design System, Forms: https://www.designsystem.qld.gov.au/components/forms/tabs/design
- GOV.UK Design System, Question pages: https://design-system.service.gov.uk/patterns/question-pages
- Matteo Penzo, "Label Placement in Forms", UXmatters, 2006: https://www.uxmatters.com/mt/archives/2006/07/label-placement-in-forms.php
- Adam Silver, "Don't mark required fields with an asterisk": https://adamsilver.io/blog/how-to-highlight-required-and-optional-form-fields/
- GOV.UK Design System, Select: https://design-system.service.gov.uk/components/select/
- GOV.UK Design System, Radios: https://design-system.service.gov.uk/components/radios/
- Nielsen Norman Group, "Toggle-Switch Guidelines": https://www.nngroup.com/articles/toggle-switch-guidelines/
