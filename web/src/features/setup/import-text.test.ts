import { describe, expect, it } from "vitest";

import { ProblemError } from "@/api/problem";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

import {
  asksForPassphrase,
  importDone,
  importError,
} from "@/features/setup/import-text";

const t: TFunction = (key, params) =>
  catalogEn[key].replace(/\{(\w+)\}/gu, (_, name: string) =>
    String(params?.[name]),
  );

const archive = {
  archive_version: 8,
  tables: [
    { name: "a", rows: 3 },
    { name: "b", rows: 4 },
  ],
  credentials_in_archive: false,
  credentials_restored: 0,
  provider_keys_restored: 0,
};

function problem(code: string, extra: object = {}) {
  return new ProblemError({
    type: "about:blank",
    title: "t",
    status: 422,
    code,
    ...extra,
  });
}

describe("importDone", () => {
  it("sums the rows of every table", () => {
    expect(importDone(archive, t)).toBe(
      "Archive imported: 7 rows, archive version 8.",
    );
  });

  it("counts the restored integrations", () => {
    expect(
      importDone(
        { ...archive, credentials_in_archive: true, credentials_restored: 2 },
        t,
      ),
    ).toBe(
      "Archive imported: 7 rows, archive version 8. Integration credentials restored: 2.",
    );
  });

  it("counts the restored provider keys beside the integrations", () => {
    expect(
      importDone(
        {
          ...archive,
          credentials_in_archive: true,
          credentials_restored: 2,
          provider_keys_restored: 1,
        },
        t,
      ),
    ).toBe(
      "Archive imported: 7 rows, archive version 8. Integration credentials restored: 2. Language model provider keys restored: 1.",
    );
    expect(
      importDone(
        { ...archive, credentials_in_archive: true, provider_keys_restored: 3 },
        t,
      ),
    ).toBe(
      "Archive imported: 7 rows, archive version 8. Language model provider keys restored: 3.",
    );
  });

  it("says when the credentials of the archive were left out", () => {
    expect(importDone({ ...archive, credentials_in_archive: true }, t)).toBe(
      `Archive imported: 7 rows, archive version 8. ${catalogEn["import.credentialsSkipped"]}`,
    );
  });
});

describe("importError", () => {
  it("names both versions of an archive of a later version", () => {
    const caught = problem("archive_too_new", {
      archive_version: 3,
      instance_version: 1,
    });
    expect(importError(caught, t)).toContain("archive version 3");
  });

  it("falls back to the message of the problem code", () => {
    expect(importError(problem("passphrase_invalid"), t)).toBe(
      catalogEn["problem.passphrase_invalid"],
    );
  });
});

describe("asksForPassphrase", () => {
  it("is true only for passphrase_required", () => {
    expect(asksForPassphrase(problem("passphrase_required"))).toBe(true);
    expect(asksForPassphrase(problem("passphrase_invalid"))).toBe(false);
    expect(asksForPassphrase(new Error("x"))).toBe(false);
  });
});
