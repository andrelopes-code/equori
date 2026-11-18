// "Create a bill that repeats": the steps of the help page on the form New schedule, stopped
// before the schedule is created.
const field = (page, name) =>
  page.locator("main [data-ui='field']").filter({ has: page.getByRole("combobox", { name, exact: true }) }).first();
const box = (page, name) =>
  page.locator("main [data-ui='field']").filter({ has: page.getByRole("textbox", { name, exact: true }) }).first();
const button = (page, name) =>
  page.locator("main [data-ui='field']").filter({ has: page.getByRole("button", { name }) }).first();
const sheet = (page) => page.getByRole("dialog").last();
const account = (page, words) => page.getByRole("button", { name: words(/^Conta Escolher conta/, /^Account Choose an account/) });
const recurrence = (page, words) => page.getByRole("group", { name: words("Recorrência", "Recurrence"), exact: true });
const ends = (page, words) => page.getByRole("group", { name: words("Termina", "Ends"), exact: true });
const create = (page, words) => page.getByRole("button", { name: words("Criar agendamento", "Create schedule") });

export default {
  id: "schedule",
  open: "/planning/schedules/new",
  video: true,
  beats: [
    {
      figure: "schedule-kind",
      target: (page, words) => field(page, words("Tipo", "Kind")),
    },
    {
      figure: "schedule-amount",
      target: (page, words) => [box(page, words("Descrição", "Description")), box(page, words("Valor", "Amount"))],
      point: (page, words) => box(page, words("Descrição", "Description")),
      act: async (page, words) => {
        await page.getByRole("textbox", { name: words("Descrição", "Description"), exact: true }).fill("Internet");
        await page.getByRole("textbox", { name: words("Valor", "Amount"), exact: true }).fill("12990");
      },
    },
    {
      figure: "schedule-account",
      target: (page, words) => [button(page, words(/^Conta Escolher conta/, /^Account Choose an account/)), field(page, words("Categoria", "Category"))],
      point: account,
      act: (page, words) => account(page, words).click(),
    },
    {
      // The account the bill leaves from; the page counts it in the step before.
      target: (page) => sheet(page).getByRole("option", { name: /^Conta corrente Itaú/ }),
      act: (page) => sheet(page).getByRole("option", { name: /^Conta corrente Itaú/ }).click(),
    },
    {
      target: (page, words) => field(page, words("Categoria", "Category")),
      act: async (page, words) => {
        await page.getByRole("combobox", { name: words("Categoria", "Category"), exact: true }).click();
        await page.getByRole("option", { name: /Internet$/ }).first().click();
      },
    },
    {
      figure: "schedule-recurrence",
      target: recurrence,
      point: (page, words) => field(page, words("Dia", "Day")),
    },
    {
      figure: "schedule-ends",
      target: ends,
    },
    {
      figure: "schedule-create",
      target: create,
    },
  ],
};
