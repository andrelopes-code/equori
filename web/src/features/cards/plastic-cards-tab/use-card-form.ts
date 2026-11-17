import { useState } from "react";
import type { SyntheticEvent } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useCreateCard, useUpdateCard } from "@/features/cards/api";
import {
  createNetwork,
  updateNetwork,
} from "@/features/cards/plastic-cards-tab/network-body";
import { useT } from "@/i18n/i18n-provider";

type Card = components["schemas"]["Card"];

export interface CardForm {
  holder: string;
  lastFour: string;
  virtual: boolean;
  network: string;
  errors: Record<string, string>;
  summary: string | null;
  pending: boolean;
  setHolder: (holder: string) => void;
  setLastFour: (digits: string) => void;
  setVirtual: (virtual: boolean) => void;
  setNetwork: (network: string) => void;
  submit: (event: SyntheticEvent) => void;
}

// The draft of the add and edit card dialog and its submit: a new card is created, a given card
// is updated with the fields that changed.
export function useCardForm(
  accountId: string,
  card: Card | undefined,
  onDone: () => void,
): CardForm {
  const t = useT();
  const create = useCreateCard();
  const update = useUpdateCard();

  const [holder, setHolder] = useState(card?.holder ?? "");
  const [lastFour, setLastFour] = useState(card?.last_four ?? "");
  const [virtual, setVirtual] = useState(card?.virtual === true);
  const [network, setNetwork] = useState(card?.network ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (holder.trim() === "") next.holder = t("accountForm.problem.holder");
    if (!/^\d{4}$/u.test(lastFour))
      next.last_four = t("accountForm.problem.lastFour");
    setErrors(next);
    setSummary(null);
    if (Object.keys(next).length > 0) return;

    send().then(onDone).catch(handleFailure);
  }

  function send(): Promise<unknown> {
    if (card !== undefined) {
      return update.mutateAsync({
        id: card.id,
        holder: holder.trim(),
        last_four: lastFour,
        ...updateNetwork(card.network, network),
      });
    }

    return create.mutateAsync({
      accountId,
      card: {
        holder: holder.trim(),
        last_four: lastFour,
        virtual,
        ...createNetwork(network),
      },
    });
  }

  function handleFailure(caught: unknown) {
    if (caught instanceof ProblemError) setErrors(fieldErrors(caught.problem));
    setSummary(errorText(caught, t));
  }

  return {
    holder,
    lastFour,
    virtual,
    network,
    errors,
    summary,
    pending: create.isPending || update.isPending,
    setHolder,
    setLastFour,
    setVirtual,
    setNetwork,
    submit,
  };
}
