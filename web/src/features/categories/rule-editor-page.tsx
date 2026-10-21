import { Page } from "@slotted/react/page";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { rulesQuery } from "@/features/categories/api";
import { MissingRule } from "@/features/categories/missing-rule";
import { RuleEditor } from "@/features/categories/rule-editor";

export function RuleEditorPage() {
  const params = useParams({ strict: false });
  const api = useApi();
  const rules = useQuery({
    ...rulesQuery(api),
    enabled: params.id !== undefined,
  });
  if (params.id === undefined) return <RuleEditor rule={null} />;
  if (rules.isPending) return <Page width="wide" loading />;
  const rule = rules.data?.find((r) => r.id === params.id);
  return rule === undefined ? (
    <MissingRule />
  ) : (
    <RuleEditor key={rule.id} rule={rule} />
  );
}
