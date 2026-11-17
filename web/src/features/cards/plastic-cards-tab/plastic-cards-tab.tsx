import { Button } from "@slotted/react/button";
import { Switch } from "@slotted/react/switch";
import { toast } from "@slotted/react/toast";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { logoIndexQuery, logoOf } from "@/features/accounts";
import { cardsQuery, useUpdateCard } from "@/features/cards/api";
import { AddCardDialog } from "@/features/cards/plastic-cards-tab/add-card-dialog";
import { DeleteCardDialog } from "@/features/cards/plastic-cards-tab/delete-card-dialog";
import { PlasticCardActions } from "@/features/cards/plastic-cards-tab/plastic-card-actions";
import { PlasticCardDetail } from "@/features/cards/plastic-cards-tab/plastic-card-detail";
import { plasticFaces } from "@/features/cards/plastic-cards-tab/plastic-card-faces";
import styles from "@/features/cards/plastic-cards-tab/plastic-cards-tab.module.css";
import { useT } from "@/i18n/i18n-provider";
import { CardFace } from "@/ui/card-face/card-face";
import { CardFaceStack } from "@/ui/card-face/card-face-stack";
import { faceColor } from "@/ui/card-face/face-color";
import { Presence } from "@/ui/dialogs/presence";

type Account = components["schemas"]["Account"];
type Card = components["schemas"]["Card"];
type Institution = components["schemas"]["Institution"];

interface PlasticCardsTabProps {
  account: Account;
  institution: Institution | undefined;
}

// The physical and virtual cards of the account, drawn as a stack; the selected one has its
// figures, its switch and its actions beside the stack.
export function PlasticCardsTab({
  account,
  institution,
}: PlasticCardsTabProps) {
  const t = useT();
  const api = useApi();
  const cards = useQuery(cardsQuery(api, account.id));
  const logos = useQuery(logoIndexQuery);
  const update = useUpdateCard();

  const [selectedId, setSelectedId] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [removing, setRemoving] = useState<Card | null>(null);

  const list = cards.data ?? [];
  const selected = list.find((card) => card.id === selectedId) ?? list[0];
  const logo = logoOf(institution?.identifier, logos.data);
  const base = {
    title: account.name,
    color: faceColor(undefined, account.color),
    ...(logo !== undefined && { logo }),
    ...(institution !== undefined && { institutionName: institution.name }),
  };

  function handleToggle(card: Card, active: boolean) {
    update.mutateAsync({ id: card.id, active }).catch((caught: unknown) => {
      toast.show({ tone: "danger", title: errorText(caught, t) });
    });
  }

  return (
    <div className={styles.tab}>
      <div className={styles.wallet}>
        <div className={styles.stackCol}>
          {cards.isPending && <CardFace {...base} holder="" loading />}

          {!cards.isPending && selected === undefined && (
            <Text size="sm" tone="muted">
              {t("card.noPlastics")}
            </Text>
          )}

          <CardFaceStack
            faces={plasticFaces(list, base)}
            selected={selected?.id ?? ""}
            onSelect={setSelectedId}
            label={t("cardFace.stack")}
          />

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
        </div>

        {selected !== undefined && (
          <PlasticCardDetail
            card={selected}
            position={list.indexOf(selected) + 1}
            count={list.length}
            toggle={
              <Switch
                aria-label={t("card.activeOf", { digits: selected.last_four })}
                checked={selected.active}
                onCheckedChange={(active) => {
                  handleToggle(selected, active);
                }}
              />
            }
            actions={
              <PlasticCardActions
                card={selected}
                onEdit={() => {
                  setEditing(selected);
                }}
                onRemove={() => {
                  setRemoving(selected);
                }}
              />
            }
          />
        )}
      </div>

      <>
        <Presence value={adding ? adding : undefined}>
          {() => (
            <AddCardDialog
              accountId={account.id}
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

        <Presence value={editing ?? undefined}>
          {(card) => (
            <AddCardDialog
              accountId={account.id}
              card={card}
              onCancel={() => {
                setEditing(null);
              }}
              onDone={() => {
                setEditing(null);
                toast.show({ tone: "success", title: t("card.cardEdited") });
              }}
            />
          )}
        </Presence>

        <Presence value={removing ?? undefined}>
          {(card) => (
            <DeleteCardDialog
              card={card}
              onCancel={() => {
                setRemoving(null);
              }}
              onDone={() => {
                setRemoving(null);
                toast.show({ tone: "success", title: t("card.cardRemoved") });
              }}
            />
          )}
        </Presence>
      </>
    </div>
  );
}
