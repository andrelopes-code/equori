import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { ProblemError, fieldErrors, problemMessage } from "@/api/problem";
import { useCompleteSetup } from "@/features/session/api";
import { useT } from "@/i18n/i18n-provider";
import type { Language } from "@/i18n/languages";

interface UseSetupSubmitProps {
  token: string;
  language: Language;
  region: string | null;
  currency: string;
  timeZone: string;
  updateCheck: boolean | null;
}

// The submit of the first-user form: it sends the setup, follows its outcome and keeps the
// failure the form shows below its fields.
export function useSetupSubmit({
  token,
  language,
  region,
  currency,
  timeZone,
  updateCheck,
}: UseSetupSubmitProps) {
  const t = useT();
  const router = useRouter();
  const complete = useCompleteSetup();
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (values: Record<string, unknown>) => {
    setFailure(null);
    if (region === null || updateCheck === null) {
      return {
        ...(region === null ? { region: t("setup.required") } : {}),
        ...(updateCheck === null ? { update_check: t("setup.required") } : {}),
      };
    }
    const booksName =
      typeof values.books_name === "string" ? values.books_name.trim() : "";
    try {
      await complete.mutateAsync({
        token,
        email: String(values.email),
        password: String(values.password),
        language,
        region,
        update_check: updateCheck,
        ...(currency === "" ? {} : { base_currency: currency }),
        ...(booksName === "" ? {} : { books_name: booksName }),
        ...(timeZone === "" ? {} : { time_zone: timeZone }),
      });
    } catch (error) {
      if (error instanceof ProblemError) {
        if (error.problem.code === "setup_complete") {
          await router.navigate({
            to: "/login",
            search: { redirect: undefined },
          });
          return undefined;
        }
        const fields = fieldErrors(error.problem);
        if (Object.keys(fields).length > 0) return fields;
        setFailure(problemMessage(error.problem, t));
        return undefined;
      }
      setFailure(t("problem.internal_error"));
      return undefined;
    }
    await router.navigate({ to: "/start" });
    return undefined;
  };

  return { submit, failure, pending: complete.isPending };
}
