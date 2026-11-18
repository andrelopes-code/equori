// "The portfolio": the figures of the reference page. The screen is read, never changed.
const summary = (page, words) => page.getByRole("region", { name: words("Resumo da carteira", "Portfolio summary") });
const figure = (page, words, pt, en) => summary(page, words).getByRole("group", { name: words(pt, en), exact: true });
const performed = (page, words) => page.getByRole("region", { name: words("Como rendeu", "How it performed"), exact: true });
const investments = (page, words) => page.getByRole("region", { name: words("Investimentos", "Investments"), exact: true });

export default {
  id: "portfolio",
  open: "/portfolio",
  video: false,
  beats: [
    {
      // The value of the portfolio: the band of the summary is wider than a figure.
      figure: "portfolio-summary",
      target: (page, words) => figure(page, words, "Valor da carteira", "Portfolio value"),
    },
    {
      figure: "portfolio-return",
      // The choice of what and when: the subject and the period of the section.
      target: (page, words) => performed(page, words).getByRole("group", { name: words("Período", "Period") }),
    },
    {
      figure: "portfolio-columns",
      target: (page, words) => investments(page, words).getByRole("button", { name: words("Colunas", "Columns") }),
    },
  ],
};
