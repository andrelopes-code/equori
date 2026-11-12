import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerResizer,
  DrawerTitle,
} from "@slotted/react/drawer";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { AccountListPlaceholder } from "@/features/transactions/account-field/account-list-placeholder";
import type { Operation } from "@/features/transactions/account-field/account-operation";
import { AccountSectionList } from "@/features/transactions/account-field/account-section-list";
import { sectionsOf } from "@/features/transactions/account-field/account-sections";
import type {
  AccountChoice,
  SuggestionView,
} from "@/features/transactions/account-field/use-account-choices";
import { useT } from "@/i18n/i18n-provider";
import { useMediaQuery, wideQuery } from "@/ui/runtime/use-media-query";

// The list of accounts in a drawer: choosing one closes it. A phone takes it as a bottom sheet;
// a wide screen, where a field opens it in compact mode, takes it as a side panel.
export function AccountSheet({
  title,
  context,
  choices,
  value,
  operation,
  compact,
  collator,
  loading,
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
  operation: Operation;
  compact: boolean;
  collator: Intl.Collator;
  // The balances are pending: the sheet draws placeholders in place of the options.
  loading: boolean;
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
  const sections = sectionsOf({
    choices: shown,
    operation,
    compact,
    suggestedId: suggestion?.accountId ?? null,
    collator,
  });

  return (
    <Drawer
      open
      side={wide ? "end" : "bottom"}
      // lg holds an option's kind, its balance and its consequence on one row each.
      size={wide ? "lg" : "content"}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerPanel>
        {!wide && <DrawerResizer />}

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
            {shown.length === 0 && (
              <Text tone="muted">
                {t("accountChoice.noMatch", { query: query.trim() })}
              </Text>
            )}

            {shown.length > 0 && loading && (
              <AccountListPlaceholder sections={sections} />
            )}

            {shown.length > 0 && !loading && (
              <AccountSectionList
                sections={sections}
                value={value}
                suggestion={suggestion}
                scale={scale}
                label={title}
                expandOther={needle !== ""}
                onPick={onPick}
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
