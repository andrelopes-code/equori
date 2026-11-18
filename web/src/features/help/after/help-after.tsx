import { useQuery } from "@tanstack/react-query";

import { AssistantAsk } from "@/features/assistant";
import { HelpLinkRows } from "@/features/help/after/help-link-rows";
import { helpGuides } from "@/features/help/model/help-guides";
import {
  helpLibraryQuery,
  symptomsOf,
} from "@/features/help/model/help-library";
import { HelpRow } from "@/features/help/row/help-row";
import styles from "@/features/help/styles/help.module.css";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";

interface HelpAfterProps {
  page: string;
  title: string;
}

// What follows a task: its symptoms, the assistant and the pages beside it (help spec, HP16).
export function HelpAfter({ page, title }: HelpAfterProps) {
  const t = useT();
  const { locale } = useAppLocaleState();
  const library = useQuery(helpLibraryQuery(locale.language, locale.region));

  const guide = helpGuides[page];
  const symptoms = symptomsOf(library.data ?? []).filter((s) =>
    guide?.symptoms?.includes(s.id),
  );
  const related = (library.data ?? []).filter((p) =>
    guide?.related?.includes(p.id),
  );

  return (
    <div className={styles.after}>
      {symptoms.length > 0 && (
        <HelpLinkRows label={t("help.after.symptoms")}>
          {symptoms.map((symptom) => (
            <HelpRow
              key={symptom.id}
              page="troubleshooting"
              hash={symptom.id}
              title={symptom.title}
              end={t("help.after.cause")}
            />
          ))}
        </HelpLinkRows>
      )}

      <AssistantAsk question={title} />

      {related.length > 0 && (
        <HelpLinkRows label={t("help.after.related")}>
          {related.map((entry) => (
            <HelpRow
              key={entry.id}
              page={entry.id}
              title={entry.document.title}
              end={t(`help.kind.${entry.kind}`)}
            />
          ))}
        </HelpLinkRows>
      )}
    </div>
  );
}
