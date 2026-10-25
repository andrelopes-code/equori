import { Button } from "@slotted/react/button";
import { Stack } from "@slotted/react/stack";
import { Switch } from "@slotted/react/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { cardsQuery, useUpdateCard } from "@/features/cards/api";
import { AddCardDialog } from "@/features/cards/add-card-dialog";
import { useT } from "@/i18n/i18n-provider";
import { PhoneList } from "@/ui/phone-list";
import { Presence } from "@/ui/presence";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

// The physical and virtual cards of the account, each switched on or off.
export function PlasticCardsTab({ accountId }: { accountId: string }) {
  const t = useT();
  const cards = useQuery(cardsQuery(useApi(), accountId));
  const update = useUpdateCard();
  const [adding, setAdding] = useState(false);
  const compact = useMediaQuery(compactQuery);
  const toggle = (card: NonNullable<typeof cards.data>[number]) => (
    <Switch
      aria-label={t("card.activeOf", { digits: card.last_four })}
      checked={card.active}
      onCheckedChange={(active) => {
        update.mutateAsync({ id: card.id, active }).catch((caught: unknown) => {
          toast.show({ tone: "danger", title: errorText(caught, t) });
        });
      }}
    />
  );
  return (
    <Stack gap={3}>
      <div>
        <Button
          variant="outline"
          onClick={() => {
            setAdding(true);
          }}
        >
          {t("card.addCard")}
        </Button>
      </div>
      {compact ? (
        <PhoneList
          label={t("card.plastics")}
          loading={cards.isPending}
          empty={t("card.noPlastics")}
          rows={(cards.data ?? []).map((card) => ({
            key: card.id,
            title: t("card.masked", { digits: card.last_four }),
            lines: [
              [
                card.holder,
                card.virtual === true ? t("card.virtual") : t("card.physical"),
              ].join(" · "),
            ],
            actions: toggle(card),
          }))}
        />
      ) : (
        <Table columns={4} variant="framed">
          <TableContent>
            <TableCaption>{t("card.plastics")}</TableCaption>
            <TableHead>
              <TableRow>
                <TableColumnHeader>{t("card.number")}</TableColumnHeader>
                <TableColumnHeader>{t("accountForm.holder")}</TableColumnHeader>
                <TableColumnHeader>{t("card.type")}</TableColumnHeader>
                <TableColumnHeader>{t("card.active")}</TableColumnHeader>
              </TableRow>
            </TableHead>
            {cards.isPending ? (
              <TableLoader skeletonRows={2} />
            ) : (
              <TableBody>
                {(cards.data ?? []).length === 0 && (
                  <TableEmpty>{t("card.noPlastics")}</TableEmpty>
                )}
                {(cards.data ?? []).map((card) => (
                  <TableRow key={card.id} value={card.id}>
                    <TableRowHeader>
                      {t("card.masked", { digits: card.last_four })}
                    </TableRowHeader>
                    <TableCell>{card.holder}</TableCell>
                    <TableCell>
                      <Tag size="sm" tone="secondary">
                        {card.virtual === true
                          ? t("card.virtual")
                          : t("card.physical")}
                      </Tag>
                    </TableCell>
                    <TableCell>{toggle(card)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </TableContent>
        </Table>
      )}
      <Presence value={adding ? adding : undefined}>
        {() => (
          <AddCardDialog
            accountId={accountId}
            onCancel={() => {
              setAdding(false);
            }}
            onDone={() => {
              setAdding(false);
              toast.show({ tone: "success", title: t("card.cardAdded") });
            }}
          />
        )}
      </Presence>
    </Stack>
  );
}
