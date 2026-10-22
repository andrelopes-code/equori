import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { InstitutionField } from "@/features/accounts/institution-field";
import { accountRoutes, nubankID } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const label = "Institution";

function Harness({ onPick }: { onPick: (id: string | null) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <InstitutionField
      aria-label={label}
      value={value}
      onChange={(id) => {
        setValue(id);
        onPick(id);
      }}
    />
  );
}

async function choose(text: string, option: RegExp) {
  const input = screen.getByRole("combobox", { name: label });
  await userEvent.click(input);
  await userEvent.type(input, text);
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

describe("InstitutionField", () => {
  it("offers the owner's institutions and picks one without a request", async () => {
    const sent: string[] = [];
    let picked: string | null = null;
    renderWithProviders(
      <Harness
        onPick={(id) => {
          picked = id;
        }}
      />,
      {
        fetch: fakeApi(
          accountRoutes({
            "POST /api/v1/institutions": () => {
              sent.push("POST");
              return json(201, {});
            },
          }),
        ),
      },
    );
    await choose("Nub", /^Nubank/);
    await waitFor(() => {
      expect(picked).toBe(nubankID);
    });
    expect(sent).toEqual([]);
  });

  it("creates a catalogue institution with its name, COMPE code and ISPB", async () => {
    const bodies: unknown[] = [];
    let picked: string | null = null;
    renderWithProviders(
      <Harness
        onPick={(id) => {
          picked = id;
        }}
      />,
      {
        fetch: fakeApi(
          accountRoutes({
            "POST /api/v1/institutions": async (req) => {
              const body: unknown = await req.json();
              bodies.push(body);
              return json(201, { id: "new-bb", ...(body as object) });
            },
          }),
        ),
      },
    );
    await choose("Banco do Bra", /^Banco do Brasil/);
    await waitFor(() => {
      expect(picked).toBe("new-bb");
    });
    expect(bodies).toEqual([
      { name: "Banco do Brasil", code: "001", ispb: "00000000" },
    ]);
  });

  it("creates an institution outside the catalogue from what was typed", async () => {
    const bodies: unknown[] = [];
    renderWithProviders(<Harness onPick={() => undefined} />, {
      fetch: fakeApi(
        accountRoutes({
          "POST /api/v1/institutions": async (req) => {
            const body: unknown = await req.json();
            bodies.push(body);
            return json(201, { id: "new-x", ...(body as object) });
          },
        }),
      ),
    });
    await choose("Cooperativa Zeta", /Cooperativa Zeta/);
    await waitFor(() => {
      expect(bodies).toEqual([{ name: "Cooperativa Zeta" }]);
    });
  });

  it("draws a bank's logo on the white plate, not on a tinted avatar", async () => {
    renderWithProviders(<Harness onPick={() => undefined} />, {
      fetch: fakeApi(accountRoutes()),
    });
    const input = screen.getByRole("combobox", { name: label });
    await userEvent.click(input);
    await userEvent.type(input, "Banco do Brasil");
    const option = await screen.findByRole("option", {
      name: /^Banco do Brasil/,
    });
    // Owner review item 14: logos drawn for a white ground vanish on the avatar's dark tint.
    expect(option.querySelector('[data-ui="avatar"]')).toBeNull();
    expect(
      option.querySelector("img")?.closest('[aria-hidden="true"]'),
    ).not.toBeNull();
  });
});
