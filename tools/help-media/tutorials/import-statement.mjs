// "Import a statement": the four steps of the help page, stopped before the file is sent, and
// the page of an import the demo book already holds.
import { fileURLToPath } from "node:url";

// The file the reader chooses. Its columns are those of the profile the demo account keeps.
const FILE = fileURLToPath(new URL("./files/extrato.csv", import.meta.url));

const account = (page) => page.locator("main").getByRole("link", { name: "Conta corrente Itaú" });
const open = (page, words) => page.getByRole("button", { name: words("Importar extrato", "Import statement") });
const field = (page, name) => page.locator("main [data-ui='field']").filter({ has: page.getByRole("combobox", { name }) });
const cancel = (page, words) => page.locator("main footer").getByRole("button", { name: words("Cancelar", "Cancel") });
const imports = (page, words) => page.getByRole("tab", { name: words(/^Importações/, /^Imports/) });
const batch = (page) => page.locator("main a[href*='/imports/']").first();

export default {
  id: "import-statement",
  open: "/accounts",
  video: true,
  beats: [
    {
      figure: "import-account",
      target: account,
      act: (page) => account(page).click(),
    },
    {
      figure: "import-open",
      target: open,
      act: (page, words) => open(page, words).click(),
    },
    {
      // The reader picks the file in the dialog of the system; the page does not number it.
      target: (page) => page.locator("main [data-part='dropzone'] [data-part='trigger']"),
      act: (page) => page.locator("main [data-part='dropzone'] input[type='file']").setInputFiles(FILE),
    },
    {
      figure: "import-csv",
      target: (page, words) => [
        field(page, words("Coluna da data", "Date column")),
        field(page, words("Formato da data", "Date format")),
        field(page, words("Coluna da descrição", "Description column")),
      ],
    },
    {
      figure: "import-confirm",
      target: (page, words) =>
        page.locator("main footer").getByRole("button", { name: words("Importar", "Import"), exact: true }),
    },
    {
      // Leaves the form without sending the file.
      only: "figure",
      target: cancel,
      act: (page, words) => cancel(page, words).click(),
    },
    {
      only: "figure",
      target: imports,
      act: (page, words) => imports(page, words).click(),
    },
    {
      only: "figure",
      target: batch,
      act: (page) => batch(page).click(),
    },
    {
      figure: "import-lines",
      only: "figure",
      target: (page) => page.locator("main").getByRole("radiogroup").first(),
    },
  ],
};
