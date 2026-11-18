// "The month's plan": the figures of the reference page, on the Plan view of the Budgets tab. The
// plan is read, never saved.
const view = (page, words) => page.getByRole("radiogroup", { name: words("Visão dos orçamentos", "Budget view") });
const plan = (page, words) => view(page, words).getByRole("radio", { name: words("Planejar", "Plan") });
const amount = (page, words) => page.getByRole("region", { name: words("Valor e distribuição", "Amount and distribution") });
const source = (page, words) => amount(page, words).getByRole("radiogroup", { name: words("De onde vem o valor", "Where the amount comes from") });
const suggest = (page, words) => page.getByRole("button", { name: words("Sugerir pelo histórico", "Suggest from history") });
const rest = (page, words) => page.getByRole("button", { name: words("Distribuir o restante", "Distribute the rest") });

export default {
  id: "budget-plan",
  open: "/planning?tab=budgets",
  video: false,
  beats: [
    {
      // The Plan view of the tab; the page names it in its lead.
      only: "figure",
      target: view,
      act: (page, words) => plan(page, words).click({ force: true }),
    },
    {
      figure: "budget-plan-source",
      target: source,
    },
    {
      figure: "budget-plan-tools",
      target: (page, words) => [rest(page, words), suggest(page, words)],
    },
  ],
};
