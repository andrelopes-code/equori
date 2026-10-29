import { Button } from "@slotted/react/button";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerTitle,
} from "@slotted/react/drawer";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { Radio, RadioGroup } from "@slotted/react/radio-group";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { compatibleKinds, kindTitle } from "@/features/accounts/account-kinds";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { useMapExternalAccount } from "@/features/accounts/api";
import { subtypeWords } from "@/features/accounts/sync-tab";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import { useOverlayOpen } from "@/ui/use-overlay-open";

type Account = components["schemas"]["Account"];
type Connection = components["schemas"]["Connection"];
type ExternalAccount = components["schemas"]["ExternalAccount"];

function previousMonthStart(today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return month === 1
    ? `${String(year - 1)}-12-01`
    : `${String(year)}-${String(month - 1).padStart(2, "0")}-01`;
}

// A35: the ledger account an external account feeds, from the first day to import; or a new
// account of the external account's kind when none fits.
export function LinkDrawer({
  connection,
  external,
  candidates,
  preselected,
  onCreate,
  onClose,
}: {
  connection: Connection;
  external: ExternalAccount;
  candidates: Account[];
  preselected: string | undefined;
  onCreate: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const today = useToday();
  const map = useMapExternalAccount();
  const [account, setAccount] = useState<string | null>(
    preselected ?? external.account_id ?? null,
  );
  const [from, setFrom] = useState(
    external.sync_from ?? previousMonthStart(today),
  );
  const [error, setError] = useState<string | null>(null);
  const subtype = subtypeWords[external.subtype];
  const kind = compatibleKinds(external.subtype)[0];
  return (
    <Drawer
      open={overlayOpen}
      side="end"
      size="md"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerPanel>
        <DrawerHeader>
          <DrawerTitle>
            {t("links.drawerTitle", { name: external.name })}
          </DrawerTitle>
          <DrawerDescription>
            {[
              connection.name,
              subtype === undefined ? external.subtype : t(subtype),
              external.number_last4 === undefined
                ? undefined
                : t("account.lastFour", { digits: external.number_last4 }),
              external.currency,
            ]
              .filter((p) => p !== undefined)
              .join(" · ")}
          </DrawerDescription>
          <DrawerClose />
        </DrawerHeader>
        <DrawerBody>
          <Stack gap={5}>
            {candidates.length === 0 ? (
              <Text size="sm">{t("links.noCandidate")}</Text>
            ) : (
              <Field required>
                <FieldLabel>{t("links.chooseAccount")}</FieldLabel>
                <RadioGroup
                  name="account"
                  variant="tile"
                  value={account ?? ""}
                  onValueChange={(value) => {
                    setAccount(value);
                  }}
                >
                  {candidates.map((candidate) => (
                    <Radio
                      key={candidate.id}
                      value={candidate.id}
                      description={
                        candidate.kind === undefined
                          ? undefined
                          : t(kindTitle[candidate.kind])
                      }
                    >
                      <Inline gap={3} wrap="nowrap">
                        <AccountAvatar account={candidate} size="sm" />
                        <Text size="sm" weight="medium">
                          {candidate.name}
                        </Text>
                      </Inline>
                    </Radio>
                  ))}
                </RadioGroup>
              </Field>
            )}
            {kind !== undefined && (
              <div>
                <Button variant="outline" tone="secondary" onClick={onCreate}>
                  {t("links.createAccount")}
                </Button>
              </div>
            )}
            <Field invalid={error !== null}>
              <FieldLabel>{t("sync.from")}</FieldLabel>
              <DateInput
                name="sync_from"
                value={from}
                onChange={setFrom}
                shortcuts={false}
              />
              <FieldDescription>{t("links.fromHint")}</FieldDescription>
              {error !== null && <FieldError>{error}</FieldError>}
            </Field>
          </Stack>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button
            disabled={account === null || account === ""}
            loading={map.isPending}
            onClick={() => {
              if (account === null) return;
              setError(null);
              map
                .mutateAsync({
                  connectionId: connection.id,
                  externalId: external.id,
                  mapping: { account_id: account, sync_from: from },
                })
                .then(onClose)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("links.confirm")}
          </Button>
        </DrawerFooter>
      </DrawerPanel>
    </Drawer>
  );
}
