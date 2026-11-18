// "Check an account's balance": the four steps of the help page, stopped before the comparison
// is sent, and the figure of a difference left open by an earlier check of the demo book.
const dialog = (page) => page.getByRole("dialog").last();
const account = (page) => page.locator("main").getByRole("link", { name: "Conta corrente Itaú" });
// The name of the account and its kind under it, the two texts of the row's first cell: the
// row itself is wider than a figure.
const row = (page) => {
  const texts = page.locator("main th").filter({ has: page.getByRole("link", { name: "Conta corrente Itaú" }) }).locator("[data-ui='typography']");

  return [texts.nth(0), texts.nth(1)];
};
const open = (page, words) => page.getByRole("button", { name: words("Conferir saldo", "Record balance") });
const cancel = (page, words) => dialog(page).getByRole("button", { name: words("Cancelar", "Cancel") });

export default {
  id: "check-balance",
  open: "/accounts",
  video: true,
  beats: [
    {
      figure: "check-account",
      target: row,
      act: (page) => account(page).click(),
    },
    {
      figure: "check-open",
      target: open,
      act: (page, words) => open(page, words).click(),
    },
    {
      figure: "check-values",
      frame: dialog,
      target: (page) => [
        dialog(page).locator("[data-ui='field']").nth(0),
        dialog(page).locator("[data-ui='field']").nth(1),
      ],
    },
    {
      figure: "check-compare",
      frame: dialog,
      target: (page, words) =>
        dialog(page).getByRole("button", { name: words("Comparar saldos", "Compare and reconcile") }),
    },
    {
      // Leaves the dialog without sending it; the tab under it holds the open difference.
      only: "figure",
      target: cancel,
      act: (page, words) => cancel(page, words).click(),
    },
    {
      figure: "check-difference",
      only: "figure",
      // The actions that settle the difference: on a wide screen the alert is wider than a figure.
      target: (page) =>
        [0, 1, 2].map((index) => page.locator("main [data-ui='alert']").first().getByRole("button").nth(index)),
    },
  ],
};
