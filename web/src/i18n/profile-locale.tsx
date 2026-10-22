import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useApi } from "@/api/api-context";
import { useAppLocaleState } from "@/i18n/i18n-provider";
import { isLanguage } from "@/i18n/languages";
import { meQuery } from "@/features/session";

// The profile is the source of truth: once GET /me answers, its language and region replace
// the pair kept in the browser.
export function ProfileLocale() {
  const { data: me } = useQuery({ ...meQuery(useApi()), staleTime: Infinity });
  const { setLocale } = useAppLocaleState();
  const language = me?.language;
  const region = me?.region;
  useEffect(() => {
    if (typeof language === "string" && isLanguage(language) && region) {
      setLocale({ language, region });
    }
  }, [language, region, setLocale]);
  return null;
}
