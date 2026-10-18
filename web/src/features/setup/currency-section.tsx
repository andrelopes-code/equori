import { useQuery } from "@tanstack/react-query";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
import { toast } from "@slotted/react/toast";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, problemMessage } from "@/api/problem";
import {
  hasTransactionsQuery,
  instrumentsQuery,
  settingsQuery,
  useUpdateSettings,
} from "@/features/setup/api";
import styles from "@/features/setup/currency-section.module.css";
import { OptionSelect } from "@/features/setup/option-select";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

export function CurrencySection() {
  const t = useT();
  const api = useApi();
  const settings = useQuery(settingsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const hasTransactions = useQuery(hasTransactionsQuery(api));
  const update = useUpdateSettings();
  const [lockedByServer, setLockedByServer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (code: string) => {
    setError(null);
    try {
      await update.mutateAsync({ base_currency: code });
    } catch (failure) {
      if (failure instanceof ProblemError) {
        if (failure.problem.code === "settings_locked") {
          setLockedByServer(true);
        } else {
          setError(problemMessage(failure.problem, t));
        }
      } else {
        setError(t("settings.failed"));
      }
      return;
    }
    toast.show({ title: t("settings.currency.done") });
  };

  const failed = [settings, instruments].find((q) => q.isError);
  let body;
  if (failed?.error) {
    body = (
      <QueryError
        error={failed.error}
        onRetry={() => {
          void failed.refetch();
        }}
      />
    );
  } else if (settings.data === undefined || instruments.data === undefined) {
    body = (
      <SkeletonRegion>
        <Skeleton shape="text" inlineSize="40%" />
      </SkeletonRegion>
    );
  } else {
    // While the check is pending the currency reads as locked, so a lock is never offered as editable.
    const locked =
      lockedByServer || hasTransactions.isPending
        ? true
        : hasTransactions.data === true;
    const code = settings.data.base_currency;
    const name = instruments.data.items.find((i) => i.code === code)?.name;
    body = (
      <>
        {locked ? (
          <div
            role="group"
            aria-label={t("settings.currency.label")}
            className={styles.statement}
          >
            <p className={styles.line}>
              <span className={styles.code}>{code}</span>
              {name !== undefined && (
                <span className={styles.name}>{name}</span>
              )}
            </p>
            <p className={styles.note}>{t("problem.settings_locked")}</p>
          </div>
        ) : (
          <OptionSelect
            label={t("settings.currency.label")}
            value={code}
            options={instruments.data.items
              .filter((i) => i.type === "currency")
              .map((i) => ({ value: i.code, label: i.code }))}
            disabled={update.isPending}
            onChange={(next) => void choose(next)}
          />
        )}
        {error !== null && (
          <Alert tone="danger" role="alert">
            <AlertContent>
              <AlertDescription>{error}</AlertDescription>
            </AlertContent>
          </Alert>
        )}
      </>
    );
  }

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("settings.currency.title")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>{body}</SectionBody>
    </Section>
  );
}
