// "Create a budget": the steps of the help page on the form New budget, stopped before the budget
// is created.
const field = (page, role, name) =>
  page.locator("main [data-ui='field']").filter({ has: page.getByRole(role, { name, exact: true }) }).first();
const category = (page, words) => page.getByRole("combobox", { name: words("Categoria", "Category"), exact: true });
const amount = (page, words) => page.getByRole("textbox", { name: words("Valor mensal", "Monthly amount"), exact: true });
const carry = (page, words) =>
  page.getByRole("checkbox", { name: words("Transportar o saldo para o mês seguinte", "Carry the balance to the next month") });
const create = (page, words) => page.getByRole("button", { name: words("Criar orçamento", "Create budget") });

export default {
  id: "create-budget",
  open: "/planning/budgets/new",
  video: true,
  beats: [
    {
      figure: "budget-category",
      target: (page, words) => field(page, "combobox", words("Categoria", "Category")),
      act: async (page, words) => {
        await category(page, words).click();
        await page.getByRole("option", { name: /Hobbies$/ }).first().click();
      },
    },
    {
      figure: "budget-amount",
      target: (page, words) => field(page, "textbox", words("Valor mensal", "Monthly amount")),
      act: (page, words) => amount(page, words).fill("20000"),
    },
    {
      figure: "budget-month",
      target: (page, words) => field(page, "group", words("Primeiro mês", "First month")),
    },
    {
      figure: "budget-carry",
      // The checkbox with its label and its description.
      target: (page, words) => page.locator("main [data-ui='checkbox']").filter({ has: carry(page, words) }),
      point: carry,
      act: (page, words) => carry(page, words).click(),
    },
    {
      figure: "budget-create",
      target: create,
    },
  ],
};
