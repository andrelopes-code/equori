import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import {
  categorizationQuery,
  ruleNameQuery,
} from "@/features/transactions/api";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

const methodWords: Record<string, MessageKey> = {
  rule: "method.rule",
  source: "method.source",
  history: "method.history",
  manual: "method.manual",
};

// How the categories were decided (A20): the method in words, and the rule's name when a rule did.
export function CategorizationText({ id }: { id: string }) {
  const t = useT();
  const api = useApi();
  const decision = useQuery(categorizationQuery(api, id));
  const ruleId = decision.data?.rule_id;
  const rule = useQuery({
    ...ruleNameQuery(api, ruleId ?? ""),
    enabled: ruleId !== undefined,
  });
  const method = decision.data?.method;
  if (decision.isPending) return null;
  if (method === undefined || method === null) {
    return <>{t("method.none")}</>;
  }
  if (method === "rule") {
    return (
      <>
        {rule.data === undefined
          ? t("method.rule")
          : t("method.ruleNamed", { rule: rule.data })}
      </>
    );
  }
  return <>{t(methodWords[method] ?? "method.manual")}</>;
}
