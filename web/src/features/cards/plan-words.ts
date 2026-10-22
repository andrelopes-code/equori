import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

type InstallmentPlan = components["schemas"]["InstallmentPlan"];

export const planStatusWords: Record<InstallmentPlan["status"], MessageKey> = {
  active: "plan.status.active",
  cancelled: "plan.status.cancelled",
  anticipated: "plan.status.anticipated",
};

export const planStatusTone = {
  active: "accent",
  cancelled: "secondary",
  anticipated: "success",
} as const;
