import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

import { catalogEn } from "@/i18n/catalog.en";

// Chooses a kind on the entry picker: a segment for the frequent kinds, an item of the
// "Other kinds" menu for the rest.
export async function chooseEntryKind(user: UserEvent, name: string) {
  await screen.findByRole("radio", { name: catalogEn["entry.kind.expense"] });

  const segment = screen.queryByRole("radio", { name });
  if (segment !== null) {
    await user.click(segment);
    return;
  }

  await user.click(
    screen.getByRole("button", { name: catalogEn["entry.otherKinds"] }),
  );
  await user.click(await screen.findByRole("menuitemradio", { name }));
}
