// "Record transactions as text": the steps of the help page on the screen of text capture,
// stopped before the drafts are recorded.
//
// The text is the same in every language: the preview and the suggestions are requests with a
// body, recorded once under the hash of that body.
const TEXT = "Geladeira 3600 10x final 4812 #casa\nMercado 230,50 17/11 final 4812";

const dialog = (page) => page.getByRole("dialog").last();
// The composer: the field and the keys that record, under it.
const field = (page) => page.locator("main [data-ui='prompt-composer']");
const text = (page, words) => page.getByRole("textbox", { name: words("Transações", "Transactions"), exact: true });
const fallback = (page, words) =>
  page.locator("main [data-ui='field']").filter({ has: page.getByText(words("Conta padrão", "Default account")) }).first();
// The drafts under their heading.
const drafts = (page, words) => page.getByRole("list", { name: words(/^Rascunhos/, /^Drafts/) }).first();
const edit = (page, words) => page.getByRole("button", { name: words("Editar linha 2", "Edit line 2") });
const category = (page, words) =>
  dialog(page).locator("[data-ui='field']").filter({ has: page.getByRole("combobox", { name: words("Categoria", "Category"), exact: true }) });
const apply = (page, words) => dialog(page).getByRole("button", { name: words("Aplicar", "Apply"), exact: true });
const record = (page, words) =>
  page.getByRole("group", { name: words("Ações do formulário", "Transaction form actions") }).getByRole("button", { name: words(/^Registrar/, /^Record/) });

export default {
  id: "text-capture",
  open: "/transactions/capture",
  video: true,
  reads: ["POST /api/v1/capture/preview", "POST /api/v1/capture/suggestions"],
  beats: [
    {
      // The default account and the composer stand close: a mark around the composer alone
      // would cross the hint of the account.
      figure: "capture-text",
      target: (page, words) => [fallback(page, words), field(page)],
      point: field,
      act: (page, words) => text(page, words).fill(TEXT),
    },
    {
      // The drafts with their buttons: a mark around one draft or one button would cross the
      // text of its neighbour.
      figure: "capture-drafts",
      target: drafts,
      point: edit,
      act: (page, words) => edit(page, words).click(),
    },
    {
      figure: "capture-category",
      frame: dialog,
      target: category,
      act: async (page, words) => {
        await dialog(page).getByRole("combobox", { name: words("Categoria", "Category"), exact: true }).click();
        await page.getByRole("option", { name: /Mercado$/ }).first().click();
      },
    },
    {
      // The change of the line stays in the draft; nothing is sent.
      target: apply,
      act: (page, words) => apply(page, words).click(),
    },
    {
      figure: "capture-record",
      target: record,
    },
  ],
};
