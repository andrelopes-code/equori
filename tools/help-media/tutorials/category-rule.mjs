// "Create a category rule": the five steps of the help page, stopped before the rule is saved.
const tab = (page, words) => page.getByRole("tab", { name: words(/^Regras/, /^Rules/) });
const create = (page, words) => {
  const name = words("Nova regra", "New rule");

  return page.getByRole("link", { name }).or(page.getByRole("button", { name }));
};
const when = (page, words) => page.getByRole("group", { name: words("Se a transação", "If the transaction") });
const then = (page, words) => page.getByRole("group", { name: words("Então", "Then"), exact: true });
const name = (page, words) => page.getByRole("textbox", { name: words("Nome", "Name"), exact: true });
const word = (page, words) => when(page, words).getByRole("textbox").first();
const category = (page, words) => then(page, words).getByRole("combobox", { name: words("Valor", "Value") });

export default {
  id: "category-rule",
  open: "/categories",
  video: true,
  // The preview of a rule is a request with a body that changes nothing.
  reads: ["POST /api/v1/rules/preview"],
  beats: [
    {
      // The Rules tab; the page counts it in the first step.
      target: tab,
      act: (page, words) => tab(page, words).click(),
    },
    {
      figure: "rule-new",
      target: create,
      act: (page, words) => create(page, words).click(),
    },
    {
      // The preview waits for a rule with a name; the name is the same in every language, so
      // one recorded preview answers both.
      target: name,
      act: (page, words) => name(page, words).fill("Starbucks"),
    },
    {
      // The reader types the word the description holds; the page does not number it.
      target: word,
      act: (page, words) => word(page, words).fill("starbucks"),
    },
    {
      figure: "rule-conditions",
      target: when,
    },
    {
      target: category,
      act: async (page, words) => {
        await category(page, words).click();
        await page.getByRole("option", { name: /Restaurantes/ }).first().click();
      },
    },
    {
      figure: "rule-actions",
      target: then,
    },
    {
      figure: "rule-preview",
      target: (page, words) =>
        page.locator("main [data-ui='section']").filter({ hasText: words("O que ela faria", "What it would do") }),
    },
    {
      figure: "rule-save",
      target: (page, words) => page.getByRole("button", { name: words("Salvar regra", "Save rule") }),
    },
  ],
};
