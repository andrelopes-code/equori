import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { AssetPickerList } from "@/features/portfolio/contribution-plan/editor/asset-picker-list";
import type { MemberRef } from "@/features/portfolio/contribution-plan/model/plan-edits";
import {
  filterPickerEntries,
  pickerEntries,
} from "@/features/portfolio/contribution-plan/editor/picker-entries";
import { instrumentsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

interface AssetPickerDialogProps {
  open: boolean;
  // Member key to the name of the class that holds it.
  taken: ReadonlyMap<string, string>;
  onPick: (ref: MemberRef) => void;
  onClose: () => void;
}

// Two lists, filtered by one search field: the accounts and the instruments a member can be.
export function AssetPickerDialog({
  open,
  taken,
  onPick,
  onClose,
}: AssetPickerDialogProps) {
  const t = useT();
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));

  const [query, setQuery] = useState("");

  const shown = filterPickerEntries(
    pickerEntries(accounts.data ?? [], instruments.data?.items ?? []),
    query,
  );
  const choices = [
    {
      title: t("contributionPlan.pickAccounts"),
      items: shown.accounts.map((a) => ({
        name: a.name,
        code: a.currency,
        ref: { accountId: a.id },
      })),
    },
    {
      title: t("contributionPlan.pickInstruments"),
      items: shown.instruments.map((i) => ({
        name: i.name,
        code: i.code,
        ref: { instrument: i.code },
      })),
    },
  ];

  function handleOpenChange(next: boolean) {
    if (next) return;
    setQuery("");
    onClose();
  }

  return (
    <Dialog open={open} size="md" onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("contributionPlan.addAsset")}</DialogTitle>

          <TextField
            type="search"
            autoComplete="off"
            aria-label={t("contributionPlan.pickerSearch")}
            placeholder={t("contributionPlan.pickerSearch")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </DialogHeader>

        <DialogBody>
          <Stack gap={6}>
            {choices.map((list) => (
              <AssetPickerList
                key={list.title}
                title={list.title}
                items={list.items}
                taken={taken}
                onPick={(ref) => {
                  setQuery("");
                  onPick(ref);
                }}
              />
            ))}
          </Stack>
        </DialogBody>

        <DialogFooter>
          <DialogClose
            render={(props) => (
              <Button {...props} variant="outline" tone="secondary">
                {t("contributionPlan.keepEditing")}
              </Button>
            )}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
