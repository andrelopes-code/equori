import { renderHook } from "@testing-library/react";
import type { MarkdownNode } from "@slotted/core/markdown";
import { createElement } from "react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  maskAmountText,
  maskAmounts,
  maskMatch,
} from "@/features/assistant/mask-amounts";
import { I18nProvider } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { PrivacyProvider } from "@/privacy/privacy-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { hideAmounts } from "@/testing/privacy";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, {
    locale: { language: "en", region: "US" },
    children: createElement(PrivacyProvider, null, children),
  });
}

describe("maskAmounts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["Gastou R$ 1.234,56 em outubro", `Gastou R$ ${MASK} em outubro`],
    ["Gastou 1.234,56 em outubro", `Gastou ${MASK} em outubro`],
    ["1234.56 BRL", `${MASK} BRL`],
    ["2026-10-23", "2026-10-23"],
    ["3 transações", "3 transações"],
  ])("masks %s", (input, expected) => {
    expect(maskAmountText(input)).toBe(expected);
  });

  it("writes a dollar amount as the hidden money format does", () => {
    hideAmounts();
    const { result } = renderHook(() => useMoneyFormat(), { wrapper });
    const hidden = result.current.money({ amount: 123456, currency: "USD" }, 2);
    expect(maskAmountText("$1,234.56")).toBe(hidden);
  });

  it("masks the text nodes of a tree and keeps link targets", () => {
    const tree: MarkdownNode = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Saldo 10,00 em " },
            {
              type: "link",
              url: "/cards",
              children: [{ type: "text", value: "Cartões 1,00" }],
            },
          ],
        },
      ],
    };
    expect(JSON.stringify(maskAmounts(tree, maskMatch))).toBe(
      JSON.stringify({
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [
              { type: "text", value: `Saldo ${MASK} em ` },
              {
                type: "link",
                url: "/cards",
                children: [{ type: "text", value: `Cartões ${MASK}` }],
              },
            ],
          },
        ],
      }),
    );
  });
});
