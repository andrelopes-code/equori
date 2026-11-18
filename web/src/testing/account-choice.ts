import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// An account field opens its accounts in a drawer titled by the field's label: the button the
// label names, then the account's option inside the drawer. A search opens the block "Other
// accounts", so an account of any kind is found by its name. The field's name ends at a word
// boundary: the navigation column draws a button "Accounts", which the label "Account" starts.
export async function chooseAccount(field: string, account: string) {
  await userEvent.click(
    await screen.findByRole("button", { name: new RegExp(`^${field}(?!\\w)`) }),
  );
  const sheet = await screen.findByRole("dialog", { name: field });
  await userEvent.type(await within(sheet).findByRole("searchbox"), account);
  await userEvent.click(
    await within(sheet).findByRole("option", {
      name: new RegExp(`^${account}`),
    }),
  );
}

// Opens the block "Other accounts" of an account sheet that is already open, once the list is
// drawn, so the options of every kind are in the page.
export async function openOtherAccounts() {
  await screen.findByRole("listbox");
  const other = screen.queryByRole("button", { name: /^Other accounts/ });
  if (other?.getAttribute("aria-expanded") === "false") {
    await userEvent.click(other);
  }
}
