// "Pay a statement": the five steps of the help page, the two clicks between them that the page
// does not number, and the figure of the statement's total.
const dialog = (page) => page.getByRole("dialog").last();

export default {
  id: "pay-statement",
  open: "/cards",
  video: true,
  beats: [
    {
      figure: "pay-cards",
      target: (page) => page.locator('main a[href^="/cards/"]').first(),
      act: (page) => page.locator('main a[href^="/cards/"]').first().click(),
    },
    {
      // The open statement of the card; the page does not number this click.
      target: (page) => page.locator("main a[href*='/statements/']").first(),
      act: (page) => page.locator("main a[href*='/statements/']").first().click(),
    },
    {
      figure: "statement-total",
      only: "figure",
      target: (page) => page.locator("main dt", { hasText: /^Total$/ }).first().locator("xpath=.."),
    },
    {
      figure: "pay-open",
      target: (page, words) => page.getByRole("button", { name: words(/^Pagar/, /^Pay/) }).first(),
      act: (page, words) => page.getByRole("button", { name: words(/^Pagar/, /^Pay/) }).first().click(),
    },
    {
      figure: "pay-amount",
      frame: dialog,
      target: (page) => dialog(page).locator("[data-ui='field']").nth(0),
    },
    {
      figure: "pay-account",
      frame: dialog,
      target: (page) => [
        dialog(page).locator("[data-ui='field']").nth(1),
        dialog(page).locator("[data-ui='field']").nth(2),
      ],
    },
    {
      figure: "pay-confirm",
      frame: dialog,
      target: (page, words) => dialog(page).getByRole("button", { name: words("Pagar fatura", "Pay statement") }),
    },
  ],
};
