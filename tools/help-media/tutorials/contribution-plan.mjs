// "The contribution plan": the figures of the reference page. The plan is read, never edited.
const month = (page, words) => page.getByRole("region", { name: words("Este mês", "This month") });
// The amount: its label and its field, side by side.
const amount = (page, words) => [
  month(page, words).getByText(words("Aporte", "Contribution"), { exact: true }).first(),
  month(page, words).getByRole("textbox", { name: words("Aporte", "Contribution") }),
];
const list = (page, words) => month(page, words).getByRole("list", { name: words("Comprar agora", "Buy now") });
// The first purchase of the list: the row that opens the panel of its asset. With the panel open the
// list narrows to a column, and the row fits in a figure.
const purchase = (page, words) => list(page, words).getByRole("button").first();
const ideal = (page, words) => page.getByRole("region", { name: words("Carteira frente ao ideal", "Portfolio against the target") });
// The words of the first group: where it stands against its target and what it receives.
const verdict = (page, words) =>
  ideal(page, words).locator("p, span").filter({ hasText: words(/ do ideal \(hoje/, / target \(today/) }).first();
const panel = (page, words) => page.getByRole("region", { name: words(/^Critérios de/, /^Criteria of/) });
// The first criterion of an asset without one: the field that writes it.
const newCriterion = (page, words) =>
  panel(page, words).getByRole("textbox", { name: words("Novo critério", "New criterion") });
const edit = (page, words) => page.getByRole("button", { name: words("Editar grupos e ideais", "Edit groups and targets") });

export default {
  id: "contribution-plan",
  open: "/portfolio/contribution-plan",
  video: false,
  // The split of the month is computed by a preview, a request with a body that changes nothing.
  reads: ["POST /api/v1/contribution-plan/preview"],
  beats: [
    {
      figure: "plan-month",
      target: amount,
      act: (page, words) => purchase(page, words).click(),
    },
    {
      figure: "plan-list",
      target: purchase,
    },
    {
      figure: "plan-criteria",
      target: newCriterion,
      // The panel closes, and the figures after it show the page as it opens.
      act: (page, words) => panel(page, words).getByRole("button", { name: words("Fechar", "Close") }).click(),
    },
    {
      figure: "plan-ideal",
      target: verdict,
    },
    {
      figure: "plan-edit",
      target: edit,
    },
  ],
};
