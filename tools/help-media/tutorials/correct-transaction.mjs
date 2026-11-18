// "Correct or void a transaction": the steps of the help page from the list of transactions to
// the correction form, stopped before the correction is saved.
const NAME = "Pão de Açúcar";

const row = (page) => page.getByRole("row", { name: new RegExp(`^Selecion\\w+ ${NAME}|^Select ${NAME}`) }).first();
const description = (page) => row(page).getByRole("rowheader");
const more = (page, words) => page.getByRole("button", { name: words("Ações da transação", "Transaction actions") });
const menu = (page) => page.getByRole("menu").last();
// The header of the side panel: its title and its buttons. A mark around the button of the menu
// alone would cross the close button beside it.
const header = (page) => page.locator("main [data-ui='detail-panel'] [data-ui='page-header']");
const correct = (page, words) => menu(page).getByRole("menuitem", { name: words("Corrigir", "Correct"), exact: true });
const field = (page, label) =>
  page.locator("main [data-ui='field']").filter({ has: page.getByText(label, { exact: true }) }).first();
const reason = (page, words) => page.getByRole("textbox", { name: words("Motivo da correção", "Reason for the correction") });
const save = (page, words) => page.getByRole("button", { name: words("Salvar correção", "Save correction") });

export default {
  id: "correct-transaction",
  open: "/transactions",
  video: true,
  beats: [
    {
      figure: "correct-open",
      target: description,
      act: (page) => description(page).dblclick(),
    },
    {
      figure: "correct-menu",
      target: header,
      point: more,
      act: (page, words) => more(page, words).click(),
    },
    {
      // The menu under the header it opens from: its items, and the menu and its button, stand
      // closer than the margin of a mark.
      figure: "correct-choose",
      target: (page) => [header(page), menu(page)],
      point: correct,
      act: (page, words) => correct(page, words).click(),
    },
    {
      figure: "correct-fields",
      target: (page, words) => field(page, words("Valor", "Amount")),
      act: (page, words) => page.getByRole("textbox", { name: words("Valor", "Amount"), exact: true }).fill("9819"),
    },
    {
      figure: "correct-reason",
      target: (page, words) => field(page, words("Motivo da correção", "Reason for the correction")),
      act: (page, words) => reason(page, words).fill(words("Valor do cupom fiscal", "Amount on the receipt")),
    },
    {
      figure: "correct-save",
      target: save,
    },
  ],
};
