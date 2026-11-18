// "Record the purchase of an investment": the steps of the help page on the form New transaction,
// from the menu of the other kinds to the trade, stopped before the purchase is saved.
const kind = (page, words) => page.getByRole("group", { name: words("Tipo de transação", "Kind of transaction") }).first();
const others = (page, words) => page.getByRole("button", { name: words("Outros tipos", "Other kinds") });
const menu = (page) => page.getByRole("menu").last();
const trade = (page, words) =>
  menu(page).getByRole("menuitemradio", { name: words("Compra ou venda de investimento", "Buy or sell an investment") });
const field = (page, role, name) =>
  page.locator("main [data-ui='field']").filter({ has: page.getByRole(role, { name, exact: true }) }).first();
const broker = (page, words) =>
  page.locator("main [data-ui='field']").filter({ has: page.getByRole("button", { name: words(/^Corretora/, /^Brokerage/) }) }).first();
const investment = (page, words) => page.getByRole("combobox", { name: words("Investimento", "Investment"), exact: true });
const summary = (page, words) =>
  page.getByRole("region", { name: words("Quanto sai ou entra na conta", "What leaves or enters the account") });
const save = (page, words) =>
  page
    .getByRole("group", { name: words("Ações do formulário", "Transaction form actions") })
    .getByRole("button", { name: words("Salvar", "Save"), exact: true });

export default {
  id: "buy-investment",
  open: "/transactions/new",
  video: true,
  beats: [
    {
      // The kinds and the menu of the others: a mark around the menu button alone would cross
      // the kinds beside it.
      figure: "trade-others",
      target: kind,
      point: others,
      act: (page, words) => others(page, words).click(),
    },
    {
      // The menu under the kinds it opens from: a mark around the menu alone would cross its
      // button.
      figure: "trade-menu",
      target: (page, words) => [kind(page, words), menu(page)],
      point: trade,
      act: (page, words) => trade(page, words).click(),
    },
    {
      figure: "trade-operation",
      target: (page, words) => [field(page, "radiogroup", words("Operação", "Side")), broker(page, words)],
    },
    {
      figure: "trade-investment",
      target: (page, words) => field(page, "combobox", words("Investimento", "Investment")),
      act: async (page, words) => {
        await investment(page, words).click();
        await page.getByRole("option", { name: /^BBAS3/ }).first().click();
      },
    },
    {
      figure: "trade-quantity",
      target: (page, words) => [
        field(page, "textbox", words("Quantidade", "Quantity")),
        field(page, "textbox", words("Preço unitário", "Unit price")),
      ],
      point: (page, words) => field(page, "textbox", words("Quantidade", "Quantity")),
      act: async (page, words) => {
        await page.getByRole("textbox", { name: words("Quantidade", "Quantity"), exact: true }).fill("100");
        await page.getByRole("textbox", { name: words("Preço unitário", "Unit price"), exact: true }).fill(words("27,50", "27.50"));
      },
    },
    {
      figure: "trade-summary",
      target: summary,
    },
    {
      figure: "trade-save",
      target: save,
    },
  ],
};
