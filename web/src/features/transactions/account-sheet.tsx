import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerTitle,
} from "@slotted/react/drawer";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { AccountOptionList } from "@/features/transactions/account-option-list";
import type {
  AccountChoice,
  SuggestionView,
} from "@/features/transactions/use-account-choices";
import { useT } from "@/i18n/i18n-provider";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";

// The list of accounts in a drawer: choosing one closes it. A phone takes it as a bottom sheet;
// a wide screen, where a field opens it in compact mode, takes it as a side panel.
export function AccountSheet({
  title,
  context,
  choices,
  value,
  name,
  suggestion,
  scale,
  onPick,
  onClose,
}: {
  title: string;
  // What the entry is: "Expense of R$ 286.40 in Groceries".
  context: string;
  choices: readonly AccountChoice[];
  value: string | null;
  name: string;
  suggestion: SuggestionView | null;
  scale: (currency: string) => number;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const wide = useMediaQuery(wideQuery);
  const [query, setQuery] = useState("");
  const needle = fold(query.trim());
  const shown =
    needle === ""
      ? choices
      : choices.filter(
          (c) =>
            fold(c.account.name).includes(needle) ||
            (c.institution !== undefined &&
              fold(c.institution).includes(needle)),
        );
  return (
    <Drawer
      open
      side={wide ? "end" : "bottom"}
      size={wide ? "md" : "content"}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerPanel>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{context}</DrawerDescription>
          <DrawerClose />
        </DrawerHeader>
        <DrawerBody>
          <Stack gap={6}>
            <TextField
              type="search"
              aria-label={t("accountChoice.search")}
              placeholder={t("accountChoice.search")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />
            {shown.length === 0 ? (
              <Text tone="muted">
                {t("accountChoice.noMatch", { query: query.trim() })}
              </Text>
            ) : (
              <AccountOptionList
                choices={shown}
                value={value}
                name={name}
                suggestion={suggestion}
                scale={scale}
                label={title}
                onChange={onPick}
              />
            )}
          </Stack>
        </DrawerBody>
      </DrawerPanel>
    </Drawer>
  );
}

// Search ignores case and accents: "itau" finds "Itaú".
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}
