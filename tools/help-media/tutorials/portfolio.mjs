// "The portfolio": the figures of the reference page. The screen is read, never changed.
const summary = (page, words) => page.getByRole("region", { name: words("Resumo da carteira", "Portfolio summary") });
const figure = (page, words, pt, en) => summary(page, words).getByRole("group", { name: words(pt, en), exact: true });
const positions = (page, words) => page.getByRole("tab", { name: words("Posições", "Positions"), exact: true });
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
      // The list of investments lives on the tab of the positions.
      only: "figure",
      target: positions,
      act: (page, words) => positions(page, words).click(),
    },
    {
      figure: "portfolio-columns",
      target: (page, words) => investments(page, words).getByRole("button", { name: words("Colunas", "Columns") }),
    },
  ],
};
