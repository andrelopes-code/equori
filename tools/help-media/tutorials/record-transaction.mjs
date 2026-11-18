// "Record a transaction": the steps of the help page on the form New transaction, stopped before
// the transaction is saved.
const field = (page, label) =>
  page.locator("main [data-ui='field']").filter({ has: page.getByText(label, { exact: true }) }).first();
const kind = (page, words) => page.getByRole("group", { name: words("Tipo de transação", "Kind of transaction") });
// The label, the three common kinds and the menu of the others; the group itself spans the
// form's width, and a mark around the controls alone would cross the label above them.
const kinds = (page, words) => [
  kind(page, words).locator("legend"),
  kind(page, words).locator("[data-ui='segmented-control']"),
  kind(page, words).getByRole("button", { name: words("Outros tipos", "Other kinds") }),
];
const amount = (page, words) => page.getByRole("textbox", { name: words("Valor", "Amount"), exact: true });
const choose = (page, words) => page.getByRole("button", { name: words(/Escolher conta/, /Choose an account/) });
const sheet = (page) => page.getByRole("dialog").last();
const account = (page) => sheet(page).getByRole("option", { name: /^Conta corrente Itaú/ });
const category = (page, words) => page.getByRole("combobox", { name: words("Categoria", "Category"), exact: true });
const save = (page, words) =>
  page
    .getByRole("group", { name: words("Ações do formulário", "Transaction form actions") })
    .getByRole("button", { name: words("Salvar", "Save"), exact: true });

export default {
  id: "record-transaction",
  open: "/transactions/new",
  video: true,
  beats: [
    {
      figure: "entry-kind",
      target: kinds,
    },
    {
      figure: "entry-amount",
      target: (page, words) => field(page, words("Valor", "Amount")),
      act: (page, words) => amount(page, words).fill("4590"),
    },
    {
      figure: "entry-account",
      target: (page, words) => field(page, words("Pagar com", "Pay with")),
      act: (page, words) => choose(page, words).click(),
    },
    {
      figure: "entry-sheet",
      frame: sheet,
      target: account,
      act: (page) => account(page).click(),
    },
    {
      figure: "entry-category",
      target: (page, words) => [field(page, words("Data", "Date")), field(page, words("Categoria", "Category"))],
      act: async (page, words) => {
        await category(page, words).click();
        await page.getByRole("option", { name: /Restaurantes/ }).first().click();
      },
    },
    {
      figure: "entry-save",
      target: save,
    },
  ],
};
