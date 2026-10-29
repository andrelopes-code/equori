# Form screens

A form screen is a page, drawer or dialog whose job is to write one record. Every form of `web/` answers this guide. Mandatory reading before writing or changing a form.

Rules marked with a Slotted ID (FM-06, LA-05) are in `web/node_modules/@slotted/react/dist/docs/guidelines/`. The sources behind the other rules are listed at the end. Rules marked equori are decisions of this application. Slotted issue #19 proposes these rules for the library's `forms.md`, and issues #20, #21 and #22 the primitives that `ui/field-width`, `ui/form-layout` and `ui/form-section` stand in for. Until a release carries them, this file is the rule.

## F1 · One column at a bounded measure

- The fields of a form stand in one column, top to bottom, in the order the reader answers them (Baymard, CXL).
- The column is at most 40rem wide (equori), drawn by `FormLayout` (`ui/form-layout`). A field never spans the page's whole measure.
- A form page keeps `width="wide"` for its header and footer (web/CLAUDE.md, "Page width"); the column inside starts at the page's start edge.

## F2 · Two fields share a row only when they are one answer

- Two fields share a row only when they are parts of one value: a start and an end, a frequency and its interval, an amount and its unit (Baymard).
- Unrelated fields never share a row to fill width. The pair is a `FormRow` (`ui/form-row`) and shares its top (LA-05).
- Below 600 px of the form's width every row is one field per line.

## F3 · A field's width says what it expects

The width of a control follows the length of its expected answer (Baymard, Queensland Government Design System). A class of `ui/field-width.module.css`, set on the control, writes the step:

| Step     | Width            | Holds                                                                              |
| -------- | ---------------- | ---------------------------------------------------------------------------------- |
| `short`  | 6rem             | an integer up to 4 digits: a day of the month, an interval, a count, a percentage  |
| `date`   | the picker's own | a date (`DateInput`)                                                               |
| `medium` | 15rem            | an amount in a field, a rate, a code, a choice among short words (frequency, kind) |
| `full`   | the column       | free text, a name, a description, a picker of records (account, category, payee)   |

A field with no step is `full`.

## F4 · One control height

- Every control of a form is drawn at the form's control size (`md`, 34 px in the comfortable density).
- `MoneyInput size="panel"` is reserved for the entry forms of `features/transactions`, where the amount is the record's first answer (equori). Every other form uses `size="field"` with the `medium` step.

## F5 · Sections group a topic

- A form with more than six fields, or with fields about two or more topics, splits them into `FormSection`s (`ui/form-section`) whose legend names the topic ("Value", "When", "Repetition").
- Two sections stand 2rem apart (`--slotted-space-9`); two fields inside a section stand `--slotted-form-field-gap` apart. The larger step is what separates topics.
- A section is named by its legend only. No overline, no step number, no uppercase label.

## F6 · Every question is labelled

- Every control and every set of choices has a visible label above it (Penzo). A segmented control or radio set is a `FieldGroup` whose legend is the question ("Repeats on", "Ends").
- A label is a noun or a short question in sentence case, never a placeholder: a placeholder disappears when the reader types.

## F7 · Necessity is said once, the same way

- Required fields carry no mark; an optional field carries "(optional)" (Silver). The application sets `necessity="optional"` once, through `FieldDefaultsProvider`.
- A field the backend requires sets `required` on its `Field`, so the mark and `aria-required` follow from one fact.

## F8 · Help sits where its question is

| What the reader needs                                                | Where it goes                         |
| -------------------------------------------------------------------- | ------------------------------------- |
| The format or the consequence of one answer, in one sentence         | `FieldDescription` under the control  |
| The definition of a domain term ("business day", "carry over")       | `FieldHelp` beside the label          |
| What the whole record will do: a preview, a summary, a rule in words | the form's aside (`FormLayout aside`) |

- A description is at most one line at the column's width (about 90 characters).
- From 62rem of the form's width the aside stands beside the column, 20rem wide, and sticks under the page's chrome (LA-06). Below, it follows the last field.

## F9 · Rare answers are opened by a choice

A field most records leave empty sits in an optional group opened by a choice (FM-06): "Advanced", "Add a note". It is never shown and empty by default.

## F10 · The frame says where the reader is and what the form makes

- A form page has `PageBack`, a title that names the record ("New schedule"), and a subheading that says what the record does.
- The actions are the page's footer: the primary action names the result ("Create schedule"), the secondary actions stand before it, and the way out ("Cancel") is a ghost button before them.
- A form of more than eight fields, or one with an aside, is a page, never a dialog. A dialog form follows F1 to F9 inside the dialog's body.

## Sources

- Baymard Institute, "Avoid Multi-Column Forms": https://baymard.com/blog/avoid-multi-column-forms
- Baymard Institute, "Form Field Usability: Matching User Expectations": https://baymard.com/blog/form-field-usability-matching-user-expectations
- CXL, "Form Field Usability: Should You Use Single or Multi-Column Forms?": https://conversionxl.com/research-study/form-field-usability/
- Queensland Government Design System, Forms: https://www.designsystem.qld.gov.au/components/forms/tabs/design
- GOV.UK Design System, Question pages: https://design-system.service.gov.uk/patterns/question-pages
- Matteo Penzo, "Label Placement in Forms", UXmatters, 2006: https://www.uxmatters.com/mt/archives/2006/07/label-placement-in-forms.php
- Adam Silver, "Don't mark required fields with an asterisk": https://adamsilver.io/blog/how-to-highlight-required-and-optional-form-fields/
