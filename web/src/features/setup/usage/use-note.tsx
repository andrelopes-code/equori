import { Text } from "@slotted/react/typography";

import type { ModelUse, UsageRow } from "@/features/setup/api";
import card from "@/features/setup/assistant/assistant-card.module.css";
import { useNote } from "@/features/setup/assistant/use-answer";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface UseNoteProps {
  use: ModelUse;
  rows: readonly UsageRow[];
  now: Date;
}

// The one condition a use states beside its name (spec A6); a phone draws none.
export function UseNote({ use, rows, now }: UseNoteProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const note = useNote(use, rows, now);
  const text = noteText();

  function noteText() {
    if (note.kind === "lacks")
      return t("assistant.note.lacks", {
        model: note.model,
        list: note.missing
          .map((c) => t(`assistant.capability.${c}`))
          .join(", "),
      });

    if (note.kind === "paused")
      return t("assistant.note.paused", {
        model: note.model,
        time: new Intl.DateTimeFormat(locale, {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(note.until)),
      });

    if (note.kind === "reached")
      return t("assistant.note.reached", { model: note.model });

    return t(`assistant.note.${note.kind}`);
  }

  return (
    <Text
      size="sm"
      tone={note.kind === "lacks" ? "danger" : "muted"}
      truncate
      className={card.desk}
    >
      {text}
    </Text>
  );
}
