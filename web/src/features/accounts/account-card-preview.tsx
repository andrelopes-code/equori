import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { Heading } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";

import { useApi } from "@/api/api-context";
import { settingsQuery, useScale } from "@/features/setup";
import { AccountCard } from "@/features/accounts/account-card";
import { accountCardColor } from "@/features/accounts/account-card-kind";
import styles from "@/features/accounts/account-card-preview.module.css";
import { logoIndexQuery, logoURL } from "@/features/accounts/institution-logo";
import { formatDayMonth } from "@/i18n/format";
import type { MessageKey } from "@/i18n/catalog.en";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Card = Omit<ComponentProps<typeof AccountCard>, "scale" | "currency"> & {
  key: string;
};

const nubank = "18236120";
const itau = "60701190";

// Development only (router.tsx): the account card in every case of its specification, with fixed
// data, to check layout and contrast before a screen uses it.
export function AccountCardPreview() {
  const t = useT();
  const [locale] = useAppLocale();
  const index = useQuery(logoIndexQuery);
  const settings = useQuery(settingsQuery(useApi()));
  const scale = useScale();
  const currency = settings.data?.base_currency;
  const logo = (ispb: string) =>
    index.data === undefined ? undefined : logoURL(index.data, ispb);
  const due = t("accountCard.due", {
    date: formatDayMonth("2026-11-05", locale),
  });
  const week = [4200, 0, 12990, 3150, 8800];
  const days = [2300, 15400, 0, 4790, 1200, 32000, 6150];
  const deposits = [50000, 50000, 80000, 50000, 120000];

  const checking: Card = {
    key: "checking",
    kind: "checking",
    href: "#",
    color: accountCardColor(5),
    title: "Itaú Personnalité",
    institutionName: "Itaú",
    logo: logo(itau),
    value: 523410,
    meter: { used: 318000, total: 450000 },
    signal: days,
  };
  const credit: Card = {
    key: "credit",
    kind: "credit",
    href: "#",
    color: accountCardColor(1),
    title: "Nubank Gold",
    institutionName: "Nubank",
    logo: logo(nubank),
    value: 184277,
    context: due,
    meter: { used: 512300, total: 1000000 },
    signal: week,
  };
  const savings: Card = {
    key: "savings",
    kind: "savings",
    href: "#",
    color: accountCardColor(3),
    title: "Reserva de emergência",
    institutionName: "Nubank",
    value: 1250000,
    meter: { used: 1250000, total: 2000000 },
    signal: deposits,
  };

  const sections: { title: MessageKey; cards: Card[] }[] = [
    {
      title: "accountCardPreview.complete",
      cards: [checking, credit, savings],
    },
    {
      title: "accountCardPreview.states",
      cards: [
        { ...credit, key: "alert", meter: { used: 890000, total: 1000000 } },
        { ...credit, key: "over", meter: { used: 1040000, total: 1000000 } },
      ],
    },
    {
      title: "accountCardPreview.hidden",
      cards: [{ ...checking, key: "hidden", hidden: true }],
    },
    {
      title: "accountCardPreview.reached",
      cards: [
        {
          ...savings,
          key: "reached",
          value: 2150000,
          meter: { used: 2150000, total: 2000000 },
        },
      ],
    },
    {
      title: "accountCardPreview.partial",
      cards: [
        { ...checking, key: "no-signal", signal: undefined },
        { ...credit, key: "no-meter", meter: undefined },
        {
          ...savings,
          key: "bare",
          signal: undefined,
          meter: undefined,
          logo: undefined,
          institutionName: undefined,
        },
      ],
    },
    {
      title: "accountCardPreview.loading",
      cards: [{ ...credit, key: "loading", loading: true }],
    },
    {
      title: "accountCardPreview.colours",
      cards: [
        { ...checking, key: "yellow", color: "#f5c400" },
        { ...credit, key: "pink", color: "#ff4fa0" },
        { ...savings, key: "slot-4", color: accountCardColor(4) },
        { ...checking, key: "neutral", color: undefined },
      ],
    },
  ];

  return (
    <Page width="full">
      <PageBody>
        <Stack gap={8}>
          {sections.map((section) => (
            <Stack gap={4} key={section.title}>
              <Heading level={2} size="sm">
                {t(section.title)}
              </Heading>
              <div className={styles.grid}>
                {currency !== undefined && scale !== null
                  ? section.cards.map(({ key, ...card }) => (
                      <AccountCard
                        key={key}
                        {...card}
                        currency={currency}
                        scale={scale(currency)}
                      />
                    ))
                  : null}
              </div>
            </Stack>
          ))}
        </Stack>
      </PageBody>
    </Page>
  );
}
