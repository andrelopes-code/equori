import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// An account field opens its accounts in a drawer titled by the field's label: the button the
// label names, then the account's tile inside the drawer.
export async function chooseAccount(field: string, account: string) {
  await userEvent.click(
    await screen.findByRole("button", { name: new RegExp(`^${field}`) }),
  );
  const sheet = await screen.findByRole("dialog", { name: field });
  await userEvent.click(
    await within(sheet).findByRole("radio", {
      name: new RegExp(`^${account}`),
    }),
  );
}
