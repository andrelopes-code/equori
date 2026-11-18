// "Connect a bank": the four steps that add the credentials of an aggregator, stopped before
// they are sent. The demo book holds no bank connection, so the linking steps have no figure.
const dialog = (page) => page.getByRole("dialog").last();
const section = (page) => page.locator("main a[href$='section=integrations']");
const add = (page, words) => page.getByRole("button", { name: words("Adicionar integração", "Add integration") });

export default {
  id: "connect-bank",
  open: "/settings",
  video: false,
  beats: [
    {
      figure: "connect-settings",
      target: section,
      act: (page) => section(page).click(),
    },
    {
      figure: "connect-add",
      target: add,
      act: (page, words) => add(page, words).click(),
    },
    {
      figure: "connect-credentials",
      frame: dialog,
      target: (page) => [0, 1, 2, 3].map((index) => dialog(page).locator("[data-ui='field']").nth(index)),
    },
    {
      figure: "connect-create",
      frame: dialog,
      target: (page, words) => dialog(page).getByRole("button", { name: words("Criar", "Create"), exact: true }),
    },
  ],
};
