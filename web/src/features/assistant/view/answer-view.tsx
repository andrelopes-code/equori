import { useState } from "react";

import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import { currencySymbol } from "@/features/assistant/view/currency-symbol";
import { FORMS } from "@/features/assistant/view/view-forms";
import type { ViewUnit } from "@/features/assistant/view/view-forms";
import { FollowUpChips } from "@/features/assistant/view/follow-up-chips";
import { PlotBody } from "@/features/assistant/view/plot/plot-body";
import { SegmentedToggle } from "@/features/assistant/view/segmented-toggle";
import { useViewText } from "@/features/assistant/view/use-view-text";
import { viewCopy } from "@/features/assistant/view/view-copy";
import { ViewFoot } from "@/features/assistant/view/view-foot";
import type { ViewMode } from "@/features/assistant/view/view-foot";
import { ViewHead } from "@/features/assistant/view/view-head";
import { ViewTable } from "@/features/assistant/view/view-table";
import type { AssistantView as View } from "@/features/assistant/view/view-types";
import { ViewVerdict } from "@/features/assistant/view/view-verdict";
import styles from "@/features/assistant/view/answer-view.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface AnswerViewProps {
  view: View;
}

// A view of an answer: one anatomy for every form, the form only draws its body (V11).
export function AnswerView({ view }: AnswerViewProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const texts = useViewText(view.payload);

  const [mode, setMode] = useState<ViewMode>("chart");
  const [unit, setUnit] = useState<ViewUnit>("amount");

  const form = FORMS[view.form];
  const plot = view.payload.plot;
  const symbol = currencySymbol(view.payload, locale);
  const plotted = mode === "chart" && plot !== undefined;
  const Body = mode === "chart" && plot === undefined ? form?.Body : undefined;
  const verdict = texts.verdict.map((p) => p.text).join("");

  function handleCopy() {
    void navigator.clipboard.writeText(viewCopy({ ...texts, verdict }));
  }

  return (
    <div className={styles.answer}>
      <section className={styles.view} aria-label={texts.title}>
        <ViewHead
          icon={form?.icon ?? "chart"}
          title={texts.title}
          window={texts.window}
          unit={
            form?.unit === true &&
            plot === undefined && (
              <SegmentedToggle
                label={t("assistantView.unit")}
                value={unit}
                onChange={setUnit}
                options={[
                  {
                    value: "amount",
                    title: t("assistantView.unit.amount"),
                    content: symbol ?? t("assistantView.unit.amount"),
                  },
                  {
                    value: "share",
                    title: t("assistantView.unit.share"),
                    content: "%",
                  },
                ]}
              />
            )
          }
        />

        <ViewVerdict parts={texts.verdict} />

        {Body === undefined && !plotted && (
          <ViewTable head={texts.head} rows={texts.rows} />
        )}
        {plotted && (
          <PlotBody
            title={texts.title}
            plot={plot}
            rows={view.payload.rows.rows}
            head={texts.head}
            labels={texts.rows}
          />
        )}
        {Body !== undefined && (
          <Body
            data={view.payload.data}
            unit={unit}
            window={view.payload.window}
          />
        )}

        {texts.prov !== "" && (
          <p className={styles.prov}>
            <span className={styles.icon12}>
              <AssistantIcon name="info" />
            </span>
            <span className={styles.provText}>{texts.prov}</span>
          </p>
        )}

        <ViewFoot
          open={view.payload.open}
          switchable={form !== undefined || plot !== undefined}
          mode={mode}
          onMode={setMode}
          onCopy={handleCopy}
        />
      </section>

      <FollowUpChips items={view.payload.next} />
    </div>
  );
}
