import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import type { MemberRef } from "@/features/portfolio/contribution-plan/plan-edits";
import {
  memberKey,
  pickerEntries,
} from "@/features/portfolio/contribution-plan/picker-entries";
import { instrumentsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

interface AssetPickerDialogProps {
  open: boolean;
  // Member key to the name of the class that holds it.
  taken: ReadonlyMap<string, string>;
  onPick: (ref: MemberRef) => void;
  onClose: () => void;
}

// Two lists: the accounts and the instruments a member can be. An entry already in the plan is
// disabled and names its class.
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

  const entries = pickerEntries(
    accounts.data ?? [],
    instruments.data?.items ?? [],
  );
  const description = [
    t("contributionPlan.pickAccounts"),
    t("contributionPlan.pickInstruments"),
  ].join(", ");
  const choices = [
    {
      title: t("contributionPlan.pickAccounts"),
      items: entries.accounts.map((a) => ({
        name: a.name,
        ref: { accountId: a.id },
      })),
    },
    {
      title: t("contributionPlan.pickInstruments"),
      items: entries.instruments.map((i) => ({
        name: i.name,
        ref: { instrument: i.code },
      })),
    },
  ];

  return (
    <Dialog
      open={open}
      size="md"
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("contributionPlan.addAsset")}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Stack gap={6}>
            {choices.map((list) => (
              <Stack key={list.title} gap={2}>
                <Text weight="semibold">{list.title}</Text>

                {list.items.map((item) => {
                  const holder = taken.get(memberKey(item.ref));

                  return (
                    <Button
                      key={memberKey(item.ref)}
                      variant="ghost"
                      tone="secondary"
                      disabled={holder !== undefined}
                      onClick={() => {
                        onPick(item.ref);
                      }}
                    >
                      {item.name}
                      {holder !== undefined &&
                        ` ${t("contributionPlan.inClass", { name: holder })}`}
                    </Button>
                  );
                })}
              </Stack>
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
