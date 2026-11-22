// "Record a reimbursement": the steps of the help page from the repayment in the list of
// transactions to the dialog Mark as reimbursement, stopped before the reimbursement is marked.
// The demo book holds a repayment of last week not yet linked to its dinner (cmd/demoseed,
// pendingRepayment).
const NAME = "Rafael Mendes";

const row = (page) => page.getByRole("row", { name: new RegExp(`^(Selecionar|Select) ${NAME}`) }).first();
const description = (page) => row(page).getByRole("rowheader");
// The header of the side panel: its title and its buttons. A mark around the button of the menu
// alone would cross the close button beside it.
const header = (page) => page.locator("main [data-ui='detail-panel'] [data-ui='page-header']");
const more = (page, words) => page.getByRole("button", { name: words("Ações da transação", "Transaction actions") });
const menu = (page) => page.getByRole("menu").last();
const reimburse = (page, words) =>
  menu(page).getByRole("menuitem", { name: words("Marcar como reembolso", "Mark as reimbursement"), exact: true });
const dialog = (page) => page.getByRole("dialog").last();
const dinner = (page) => dialog(page).getByRole("checkbox", { name: /Coco Bambu/ }).first();
// The dinner's row in the list of expenses: its box, its name, its amount left and its share.
const expense = (page) =>
  dialog(page).getByRole("listitem").filter({ has: page.getByRole("checkbox", { name: /Coco Bambu/ }) }).first();
const submit = (page, words) => dialog(page).getByRole("button", { name: words("Marcar como reembolso", "Mark as reimbursement") });

export default {
  id: "reimbursement",
  open: "/transactions",
  video: true,
  beats: [
    {
      figure: "reimbursement-open",
      target: description,
      act: (page) => description(page).dblclick(),
    },
    {
      figure: "reimbursement-menu",
      target: header,
      point: more,
      act: (page, words) => more(page, words).click(),
    },
    {
      // The menu under the header it opens from: its items stand closer than the margin of a mark.
      figure: "reimbursement-choose",
      target: (page) => [header(page), menu(page)],
      point: reimburse,
      act: (page, words) => reimburse(page, words).click(),
    },
    {
      figure: "reimbursement-expenses",
      frame: dialog,
      target: expense,
      point: dinner,
      act: (page) => dinner(page).click(),
    },
    {
      figure: "reimbursement-submit",
      frame: dialog,
      target: submit,
    },
  ],
};
