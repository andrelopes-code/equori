import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

import { exportStatus } from "@/features/setup/export-status";

const t: TFunction = (key, params) =>
  catalogEn[key].replace(/\{(\w+)\}/gu, (_, name: string) =>
    String(params?.[name]),
  );

const requested = "2026-10-26T12:00:00Z";

describe("exportStatus", () => {
  it("says none was requested", () => {
    expect(exportStatus(null, t, "en")).toBe(catalogEn["export.none"]);
    expect(exportStatus(undefined, t, "en")).toBe(catalogEn["export.none"]);
  });

  it("names a pending and a failed export", () => {
    const base = { id: "e", requested_at: requested };
    expect(exportStatus({ ...base, status: "pending" }, t, "en")).toBe(
      catalogEn["export.pending"],
    );
    expect(exportStatus({ ...base, status: "failed" }, t, "en")).toBe(
      catalogEn["export.failed"],
    );
  });

  it("gives the size, date and archive version of a ready export", () => {
    expect(
      exportStatus(
        {
          id: "e",
          status: "ready",
          requested_at: requested,
          size: 18_432,
          archive_version: 8,
        },
        t,
        "en",
      ),
    ).toBe("Ready: 18 kB, requested on Oct 26, 2026, archive version 8.");
  });

  it("reads an export without archive_version as version 1", () => {
    expect(
      exportStatus(
        { id: "e", status: "ready", requested_at: requested, size: 1000 },
        t,
        "en",
      ),
    ).toContain("archive version 1.");
  });
});
