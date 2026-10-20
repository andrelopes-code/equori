import { useQuery } from "@tanstack/react-query";
import { Button } from "@slotted/react/button";
import {
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverLayer,
  PopoverTitle,
  PopoverTrigger,
} from "@slotted/react/popover";

import { Stack } from "@slotted/react/stack";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { connectionsQuery } from "@/features/connections/api";
import { ConnectionTimes } from "@/features/connections/connection-times";
import { formatDayMonth, todayISO } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

export function SyncStatus() {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const api = useApi();
  const { data } = useQuery(connectionsQuery(api));
  const { data: accounts } = useQuery(accountsQuery(api));
  const connections = data?.items ?? [];
  const accountName = new Map((accounts ?? []).map((a) => [a.id, a.name]));
  // A Meu Pluggy item reports the connector's name, so a connection is titled by the ledger
  // accounts it feeds.
  const title = (c: (typeof connections)[number]) => {
    const names = c.accounts.flatMap((x) => {
      const name =
        x.account_id === undefined ? undefined : accountName.get(x.account_id);
      return name === undefined ? [] : [name];
    });
    return names.length === 0 ? c.name : names.join(", ");
  };
  const latest = connections
    .flatMap((c) => (c.last_synced_at === undefined ? [] : [c.last_synced_at]))
    .reduce<Date | undefined>((max, at) => {
      const date = new Date(at);
      return max === undefined || date > max ? date : max;
    }, undefined);
  if (latest === undefined) return null;
  const day = todayISO(latest);
  const time =
    day === today
      ? new Intl.DateTimeFormat(locale, {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(latest)
      : formatDayMonth(day, locale);
  return (
    <Popover align="end">
      <PopoverTrigger
        render={(props) => (
          <Button {...props} size="sm" tone="secondary" variant="ghost">
            {t("sync.updated", { time })}
          </Button>
        )}
      />
      <PopoverLayer>
        <PopoverContent>
          <PopoverHeader>
            <PopoverTitle>{t("sync.detailsTitle")}</PopoverTitle>
            <PopoverDescription>
              {t("sync.detailsDescription")}
            </PopoverDescription>
            <PopoverClose />
          </PopoverHeader>
          <PopoverBody>
            <Stack gap={5}>
              {connections.map((c) => (
                <ConnectionTimes key={c.id} connection={c} title={title(c)} />
              ))}
            </Stack>
          </PopoverBody>
        </PopoverContent>
        <PopoverArrow />
      </PopoverLayer>
    </Popover>
  );
}
