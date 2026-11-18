// "Record a purchase in installments": the steps of the help page on the card page, stopped before
// the purchase is recorded.
const dialog = (page) => page.getByRole("dialog").last();
const card = (page) => page.locator('main a[href^="/cards/"]').first();
const open = (page, words) =>
  page.locator("main").getByRole("button", { name: words("Compra parcelada", "Purchase in installments") });
const field = (page, name) =>
  dialog(page).locator("[data-ui='field']").filter({ has: page.getByRole("textbox", { name, exact: true }) });
const pick = (page, name) =>
  dialog(page).locator("[data-ui='field']").filter({ has: page.getByRole("combobox", { name, exact: true }) });
const record = (page, words) => dialog(page).getByRole("button", { name: words("Registrar compra", "Record purchase") });

export default {
  id: "installments",
  open: "/cards",
  video: true,
  beats: [
    {
      figure: "installments-card",
      target: card,
      act: (page) => card(page).click(),
    },
    {
      figure: "installments-open",
      target: open,
      act: (page, words) => open(page, words).click(),
    },
    {
      figure: "installments-price",
      frame: dialog,
      // The price and the date stand side by side: a mark around the price alone would cross the
      // label of the date.
      target: (page, words) => [field(page, words("Preço", "Price")), dialog(page).locator("[data-ui='field']").nth(1)],
      point: (page, words) => field(page, words("Preço", "Price")),
      act: (page, words) => dialog(page).getByRole("textbox", { name: words("Preço", "Price"), exact: true }).fill("360000"),
    },
    {
      // The reader names the purchase; the page does not number it.
      target: (page, words) => field(page, words("Descrição (opcional)", "Description (optional)")),
      act: (page, words) =>
        dialog(page).getByRole("textbox", { name: words("Descrição (opcional)", "Description (optional)") }).fill("Notebook"),
    },
    {
      figure: "installments-count",
      frame: dialog,
      target: (page, words) => [
        pick(page, words("Categoria", "Category")),
        pick(page, words("Parcelas", "Installments")),
        field(page, words("Juros (opcional)", "Interest (optional)")),
      ],
      point: (page, words) => pick(page, words("Categoria", "Category")),
      act: async (page, words) => {
        await dialog(page).getByRole("combobox", { name: words("Categoria", "Category"), exact: true }).click();
        await page.getByRole("option", { name: /Eletrônicos/ }).first().click();
      },
    },
    {
      figure: "installments-record",
      frame: dialog,
      target: record,
    },
  ],
};
